import { createBrowserClient, createServiceClient } from './client.js';

export class SupabaseStorageService {
  private client;
  private bucketName: string;

  constructor(isServer = false, bucketName = 'ventry-assets') {
    this.client = isServer ? createServiceClient() : createBrowserClient();
    this.bucketName = bucketName;
  }

  // Upload product image
  async uploadProductImage(
    productId: string,
    file: File | Blob,
    fileName?: string
  ) {
    const extension = fileName?.split('.').pop() || 'jpg';
    const path = `products/${productId}/${fileName || `${Date.now()}.${extension}`}`;

    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl,
    };
  }

  // Upload multiple product images
  async uploadProductImages(
    productId: string,
    files: FileList | File[]
  ) {
    const uploads = Array.from(files).map((file, index) => {
      const fileName = file instanceof File ? file.name : 'image.jpg';
      const extension = fileName.split('.').pop() || 'jpg';
      return this.uploadProductImage(productId, file, `image-${index + 1}.${extension}`);
    });

    return Promise.all(uploads);
  }

  // Delete product image
  async deleteProductImage(path: string) {
    const { error } = await this.client.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) throw error;
  }

  // Upload document (invoice, receipt, etc.)
  async uploadDocument(
    type: 'invoices' | 'receipts' | 'reports' | 'imports',
    file: File | Blob,
    metadata?: Record<string, any>
  ) {
    const name = file instanceof File ? file.name : 'document';
    const fileName = `${type}/${new Date().toISOString().split('T')[0]}/${Date.now()}-${name}`;

    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .upload(fileName, file, {
        contentType: file.type,
        metadata,
      });

    if (error) throw error;

    return {
      path: data.path,
      size: file.size,
      type: file.type,
    };
  }

  // Generate signed URL for private files
  async getSignedUrl(path: string, expiresIn = 3600) {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  // List files in a directory
  async listFiles(path: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  }) {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .list(path, options);

    if (error) throw error;
    return data;
  }

  // Download file
  async downloadFile(path: string) {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .download(path);

    if (error) throw error;
    return data;
  }

  // Get file metadata
  async getFileMetadata(path: string) {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .list(path.split('/').slice(0, -1).join('/'), {
        limit: 1,
        offset: 0,
        search: path.split('/').pop(),
      });

    if (error) throw error;
    return data[0];
  }
}