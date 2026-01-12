import json
import logging
import traceback
import pika
import os
import time
import asyncio
from minio import Minio
from config import get_settings
from services import PDFExtractor, Summarizer

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s")
logger = logging.getLogger("worker")

settings = get_settings()

def main():
    logger.info("Starting RabbitMQ Worker...")
    
    # Initialize Services
    pdf_extractor = PDFExtractor()
    summarizer = Summarizer()
    
    # Initialize MinIO
    minio_client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl
    )

    # Connect to RabbitMQ
    params = pika.URLParameters(settings.rabbitmq_url)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()

    # Declare Queue & Exchange
    channel.queue_declare(queue='ai.tasks', durable=True)
    channel.exchange_declare(exchange='ai.events', exchange_type='topic', durable=True)

    def callback(ch, method, properties, body):
        logger.info(f"Received task: {len(body)} bytes")
        
        try:
            task = json.loads(body)
            file_id = task.get("file_id")
            
            # Helper to publish events
            def publish_event(status, data=None):
                payload = {"file_id": file_id, "status": status}
                if data:
                    payload.update(data)
                
                ch.basic_publish(
                    exchange='ai.events',
                    routing_key=f'summary.{file_id}',
                    body=json.dumps(payload)
                )

            publish_event("processing", {"log": "Worker received task"})

            async def process_task():
                # Download File
                response = minio_client.get_object(settings.minio_bucket_files, task['storage_path'])
                pdf_bytes = response.read()
                response.close()
                response.release_conn()
                
                # Validate
                if not await summarizer.validate_pdf(pdf_bytes):
                    publish_event("failed", {"error": "Invalid PDF file signature"})
                    return

                # Extract Text
                publish_event("processing", {"log": "Extracting text..."})
                text = pdf_extractor.extract_text(pdf_bytes)
                if not text.strip():
                     publish_event("failed", {"error": "No text extracted"})
                     return

                # Summarize
                async for event in summarizer.generate_summary_stream(
                    text=text,
                    style=task.get("style", "bullet_points"),
                    custom_instructions=task.get("custom_instructions"),
                    language=task.get("language", "en")
                ):
                    # event contains "log", "result", or "error"
                    if "result" in event:
                         publish_event("completed", {"result": event["result"]})
                    elif "error" in event:
                         publish_event("failed", {"error": event["error"]})
                    elif "log" in event:
                         publish_event("processing", {"log": event["log"]})

            asyncio.run(process_task())

        except Exception as e:
            logger.error(f"Error processing task: {e}")
            logger.error(traceback.format_exc())
            # publish_event("failed", {"error": str(e)}) # Can't publish if outside scope, but we use reliable queue

        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue='ai.tasks', on_message_callback=callback)
    
    logger.info("Waiting for messages in [ai.tasks]...")
    channel.start_consuming()

if __name__ == "__main__":
    main()
