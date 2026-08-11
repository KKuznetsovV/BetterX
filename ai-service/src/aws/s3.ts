import { S3Client } from '@aws-sdk/client-s3'
import config from 'config'

const s3Config = JSON.parse(JSON.stringify(config.get('aws.connection')))

const s3Client = new S3Client({ ...s3Config, requestChecksumCalculation: 'WHEN_REQUIRED' })

export function buildPublicObjectUrl(bucket: string, key: string): string {
    const publicEndpoint = config.has('aws.publicEndpoint')
        ? config.get<string>('aws.publicEndpoint')
        : config.has('aws.connection.endpoint')
            ? config.get<string>('aws.connection.endpoint')
            : `https://${bucket}.s3.${config.get<string>('aws.connection.region')}.amazonaws.com`

    if (publicEndpoint.includes(`://${bucket}.`)) {
        return `${publicEndpoint.replace(/\/$/, '')}/${key}`
    }

    return `${publicEndpoint.replace(/\/$/, '')}/${bucket}/${key}`
}

export default s3Client
