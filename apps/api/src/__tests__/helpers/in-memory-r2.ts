type StoredObject = {
  body: Uint8Array;
  contentType?: string;
  cacheControl?: string;
};

type R2Store = Map<string, StoredObject>;

const toUint8Array = async (
  body: ReadableStream | ArrayBuffer | Blob | string | Uint8Array | null | undefined,
): Promise<Uint8Array> => {
  if (body == null) return new Uint8Array(0);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof body === 'string') return new TextEncoder().encode(body);
  // Blob | ReadableStream — wrap with Response and read all bytes
  const buf = await new Response(body as BodyInit).arrayBuffer();
  return new Uint8Array(buf);
};

const buildR2Object = (key: string, obj: StoredObject): R2ObjectBody => {
  const responseBody = new Response(obj.body).body;
  if (!responseBody) throw new Error('in-memory-r2: missing body for synthetic Response');
  return {
    key,
    version: 'v1',
    size: obj.body.byteLength,
    etag: `mock-${key}`,
    httpEtag: `"mock-${key}"`,
    uploaded: new Date(0),
    httpMetadata: { contentType: obj.contentType, cacheControl: obj.cacheControl },
    customMetadata: {},
    range: undefined,
    checksums: { toJSON: () => ({}) },
    storageClass: 'Standard',
    body: responseBody,
    bodyUsed: false,
    arrayBuffer: async () =>
      obj.body.buffer.slice(obj.body.byteOffset, obj.body.byteOffset + obj.body.byteLength),
    text: async () => new TextDecoder().decode(obj.body),
    json: async () => JSON.parse(new TextDecoder().decode(obj.body)),
    blob: async () => new Blob([obj.body]),
    bytes: async () => obj.body,
    writeHttpMetadata(headers: Headers) {
      if (obj.contentType) headers.set('content-type', obj.contentType);
      if (obj.cacheControl) headers.set('cache-control', obj.cacheControl);
    },
  } as unknown as R2ObjectBody;
};

const buildR2Head = (key: string, obj: StoredObject): R2Object =>
  buildR2Object(key, obj) as unknown as R2Object;

export type InMemoryR2Controls = {
  bucket: R2Bucket;
  store: R2Store;
};

export const createInMemoryR2 = (): R2Bucket => createInMemoryR2WithControls().bucket;

export const createInMemoryR2WithControls = (): InMemoryR2Controls => {
  const store: R2Store = new Map();

  const bucket = {
    async put(
      key: string,
      body: ReadableStream | ArrayBuffer | Blob | string | Uint8Array | null,
      options?: R2PutOptions,
    ): Promise<R2Object> {
      const buf = await toUint8Array(body);
      const meta = options?.httpMetadata as R2HTTPMetadata | undefined;
      const stored: StoredObject = {
        body: buf,
        contentType: meta?.contentType,
        cacheControl: meta?.cacheControl,
      };
      store.set(key, stored);
      return buildR2Head(key, stored);
    },
    async get(key: string): Promise<R2ObjectBody | null> {
      const obj = store.get(key);
      if (!obj) return null;
      return buildR2Object(key, obj);
    },
    async head(key: string): Promise<R2Object | null> {
      const obj = store.get(key);
      if (!obj) return null;
      return buildR2Head(key, obj);
    },
    async delete(keys: string | string[]): Promise<void> {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const key of arr) store.delete(key);
    },
    async list(options?: R2ListOptions): Promise<R2Objects> {
      const prefix = options?.prefix ?? '';
      const objects: R2Object[] = [];
      for (const [key, obj] of store) {
        if (key.startsWith(prefix)) objects.push(buildR2Head(key, obj));
      }
      return { objects, truncated: false, delimitedPrefixes: [] } as R2Objects;
    },
    async createMultipartUpload(): Promise<never> {
      throw new Error('createMultipartUpload not implemented in in-memory R2 mock');
    },
    resumeMultipartUpload(): never {
      throw new Error('resumeMultipartUpload not implemented in in-memory R2 mock');
    },
  } as unknown as R2Bucket;

  return { bucket, store };
};
