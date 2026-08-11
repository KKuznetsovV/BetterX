import AuthAwareService from './AuthAware';

export default class UploadsService extends AuthAwareService {
    async uploadFile(file: File, type: 'post-image' | 'avatar'): Promise<string> {
        // Step 1: Ask the media service for a time-limited pre-signed PUT URL.
        // The media service uses its secret AWS credentials to generate it — they never reach the browser.
        const { data } = await this.axiosInstance.get<{ uploadUrl: string; imageUrl: string }>(
            `${import.meta.env.VITE_MEDIA_URL}/uploads/presign`,
            { params: { type, contentType: file.type } }
        );

        // Step 2: PUT the binary directly from the browser to S3.
        // No auth headers — the signature is already embedded in the presigned URL.
        const uploadResponse = await fetch(data.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
        });

        if (!uploadResponse.ok) {
            throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        // Step 3: Return the permanent public URL of the uploaded object.
        return data.imageUrl;
    }
}
