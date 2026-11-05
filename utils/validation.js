import { ObjectId } from 'mongodb';

export const ALLOWED_CATEGORIES = ['Fiction', 'Science', 'History', 'Kids', 'Others'];

export function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidObjectId(id) {
  return typeof id === 'string' && ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

export function validateBookCreate(data) {
  const { title, author, category, image, description, totalCopies } = data || {};
  const errors = [];

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Title is required and must be non-empty text.');
  }

  if (!author || typeof author !== 'string' || !author.trim()) {
    errors.push('Author is required and must be non-empty text.');
  }

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`);
  }

  if (!image || typeof image !== 'string' || !isValidUrl(image.trim())) {
    errors.push('Image must be a valid HTTP or HTTPS URL.');
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    errors.push('Description is required and must be non-empty text.');
  }

  const rawCopies = totalCopies !== undefined ? totalCopies : (data?.copies !== undefined ? data.copies : data?.quantity);
  const parsedTotalCopies = Number(rawCopies);
  if (!Number.isInteger(parsedTotalCopies) || parsedTotalCopies < 1) {
    errors.push('Total copies must be an integer greater than or equal to 1.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    message: errors.join(' '),
    sanitized: errors.length === 0 ? {
      title: title.trim(),
      author: author.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      totalCopies: parsedTotalCopies,
      copies: parsedTotalCopies,
      quantity: parsedTotalCopies,
    } : null,
  };
}

export function validateBookUpdate(data) {
  const { title, author, category, image, description, totalCopies, copies, quantity } = data || {};
  const updates = {};
  const errors = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      errors.push('Title must be non-empty text.');
    } else {
      updates.title = title.trim();
    }
  }

  if (author !== undefined) {
    if (typeof author !== 'string' || !author.trim()) {
      errors.push('Author must be non-empty text.');
    } else {
      updates.author = author.trim();
    }
  }

  if (category !== undefined) {
    if (!ALLOWED_CATEGORIES.includes(category)) {
      errors.push(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`);
    } else {
      updates.category = category;
    }
  }

  if (image !== undefined) {
    if (typeof image !== 'string' || !isValidUrl(image.trim())) {
      errors.push('Image must be a valid HTTP or HTTPS URL.');
    } else {
      updates.image = image.trim();
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string' || !description.trim()) {
      errors.push('Description must be non-empty text.');
    } else {
      updates.description = description.trim();
    }
  }

  const rawTotalCopies = totalCopies !== undefined ? totalCopies : quantity;
  if (rawTotalCopies !== undefined) {
    const parsedTotal = Number(rawTotalCopies);
    if (!Number.isInteger(parsedTotal) || parsedTotal < 1) {
      errors.push('Total copies must be an integer greater than or equal to 1.');
    } else {
      updates.totalCopies = parsedTotal;
      updates.quantity = parsedTotal;
      if (copies === undefined) {
        updates.copies = parsedTotal;
      }
    }
  }

  if (copies !== undefined) {
    const parsedCopies = Number(copies);
    if (!Number.isInteger(parsedCopies) || parsedCopies < 0) {
      errors.push('Copies must be an integer greater than or equal to 0.');
    } else {
      updates.copies = parsedCopies;
    }
  }

  return {
    isValid: errors.length === 0,
    hasFields: Object.keys(updates).length > 0,
    errors,
    message: errors.join(' '),
    updates,
  };
}

export function validateBorrowInput(data) {
  const { bookId } = data || {};
  if (!bookId || !isValidObjectId(bookId)) {
    return {
      isValid: false,
      message: 'A valid book ID is required to borrow a book.',
    };
  }
  return {
    isValid: true,
    message: '',
    bookId: String(bookId),
  };
}

