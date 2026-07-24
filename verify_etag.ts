import { generateETag } from './src/lib/backend/etag';

const data1 = { a: 1, b: 2 };
const data2 = { b: 2, a: 1 };

const etag1 = generateETag(data1);
const etag2 = generateETag(data2);

console.log('ETag 1:', etag1);
console.log('ETag 2:', etag2);
console.log('Are they equal?', etag1 === etag2);
