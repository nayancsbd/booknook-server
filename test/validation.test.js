import assert from 'node:assert/strict';
import {
  isValidObjectId,
  isValidUrl,
  validateBookCreate,
  validateBookUpdate,
  validateBorrowInput,
} from '../utils/validation.js';

assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
assert.equal(isValidObjectId('invalid-id'), false);
assert.equal(isValidObjectId('12345'), false);

assert.equal(isValidUrl('https://example.com/cover.jpg'), true);
assert.equal(isValidUrl('http://example.com/cover.jpg'), true);
assert.equal(isValidUrl('not-a-url'), false);

const emptyBook = validateBookCreate({});
assert.equal(emptyBook.isValid, false);
assert.ok(emptyBook.message.length > 0);

const validBook = validateBookCreate({
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  category: 'Fiction',
  image: 'https://example.com/hobbit.jpg',
  description: 'An unexpected journey across Middle-earth.',
  totalCopies: 4,
});
assert.equal(validBook.isValid, true);
assert.equal(validBook.sanitized.totalCopies, 4);
assert.equal(validBook.sanitized.copies, 4);

const invalidBorrow = validateBorrowInput({});
assert.equal(invalidBorrow.isValid, false);

const validBorrow = validateBorrowInput({ bookId: '507f1f77bcf86cd799439011' });
assert.equal(validBorrow.isValid, true);
assert.equal(validBorrow.bookId, '507f1f77bcf86cd799439011');

console.log('All validation unit tests passed successfully!');
