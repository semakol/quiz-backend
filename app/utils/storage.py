import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_s3_client: Optional[boto3.client] = None


def get_s3_client():
    global _s3_client
    
    if not settings.USE_OBJECT_STORAGE:
        return None
    
    if _s3_client is None:
        try:
            _s3_client = boto3.client(
                's3',
                endpoint_url=settings.YANDEX_STORAGE_ENDPOINT,
                aws_access_key_id=settings.YANDEX_STORAGE_ACCESS_KEY,
                aws_secret_access_key=settings.YANDEX_STORAGE_SECRET_KEY,
                region_name=settings.YANDEX_STORAGE_REGION,
                config=Config(signature_version='s3v4')
            )
            logger.info("S3 client initialized for Yandex Object Storage")
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}")
            raise
    
    return _s3_client


def upload_file_to_storage(file_content: BinaryIO, object_key: str, content_type: Optional[str] = None) -> bool:
    if not settings.USE_OBJECT_STORAGE:
        return False
    
    try:
        s3_client = get_s3_client()
        if s3_client is None:
            return False
        
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type
        
        s3_client.upload_fileobj(
            file_content,
            settings.YANDEX_STORAGE_BUCKET,
            object_key,
            ExtraArgs=extra_args
        )
        logger.info(f"File uploaded to storage: {object_key}")
        return True
    except ClientError as e:
        logger.error(f"Error uploading file to storage: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error uploading file: {e}")
        return False


def get_file_url(object_key: str, expires_in: int = 3600) -> Optional[str]:
    if not settings.USE_OBJECT_STORAGE:
        return None
    
    try:
        s3_client = get_s3_client()
        if s3_client is None:
            return None
        
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.YANDEX_STORAGE_BUCKET,
                'Key': object_key
            },
            ExpiresIn=expires_in
        )
        return url
    except ClientError as e:
        logger.error(f"Error generating presigned URL: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error generating URL: {e}")
        return None


def get_public_url(object_key: str) -> str:
    if not settings.USE_OBJECT_STORAGE:
        return f"/media/files/{object_key}"
    
    endpoint = settings.YANDEX_STORAGE_ENDPOINT.rstrip('/')
    bucket = settings.YANDEX_STORAGE_BUCKET
    return f"{endpoint}/{bucket}/{object_key}"


def delete_file_from_storage(object_key: str) -> bool:
    if not settings.USE_OBJECT_STORAGE:
        return False
    
    try:
        s3_client = get_s3_client()
        if s3_client is None:
            return False
        
        s3_client.delete_object(
            Bucket=settings.YANDEX_STORAGE_BUCKET,
            Key=object_key
        )
        logger.info(f"File deleted from storage: {object_key}")
        return True
    except ClientError as e:
        logger.error(f"Error deleting file from storage: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error deleting file: {e}")
        return False


def file_exists_in_storage(object_key: str) -> bool:
    if not settings.USE_OBJECT_STORAGE:
        return False
    
    try:
        s3_client = get_s3_client()
        if s3_client is None:
            return False
        
        s3_client.head_object(
            Bucket=settings.YANDEX_STORAGE_BUCKET,
            Key=object_key
        )
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False
        logger.error(f"Error checking file existence: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error checking file: {e}")
        return False
