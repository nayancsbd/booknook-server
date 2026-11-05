import { connectToDatabase } from './db.js';

const SEED_BOOKS = [
  {
    title: "The Midnight Library",
    author: "Matt Haig",
    category: "Fiction",
    image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
    description: "Between life and death there is a library containing infinite books, each telling the story of another reality you could have lived. Nora Seed finds herself faced with the possibility of changing her life for a new one.",
    totalCopies: 4,
    copies: 4,
    quantity: 4,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-10-01T10:00:00Z"),
  },
  {
    title: "Cosmos",
    author: "Carl Sagan",
    category: "Science",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600",
    description: "The story of fifteen billion years of cosmic evolution transforming matter into consciousness, exploring science, civilization, and our fragile place in the grand expanse of space.",
    totalCopies: 3,
    copies: 3,
    quantity: 3,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-10-05T12:00:00Z"),
  },
  {
    title: "Sapiens: A Brief History of Humankind",
    author: "Yuval Noah Harari",
    category: "History",
    image: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=600",
    description: "A groundbreaking survey of how human biology and cultural history have defined our species, from early foraging ancestors in the Stone Age to the modern Silicon Age.",
    totalCopies: 5,
    copies: 5,
    quantity: 5,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-10-10T14:30:00Z"),
  },
  {
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    category: "Kids",
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
    description: "A poetic and philosophical tale of a young boy who journeys across planets in space, gently touching upon timeless themes of solitude, devotion, friendship, and childhood innocence.",
    totalCopies: 2,
    copies: 2,
    quantity: 2,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-10-15T09:15:00Z"),
  },
  {
    title: "Braiding Sweetgrass",
    author: "Robin Wall Kimmerer",
    category: "Others",
    image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600",
    description: "Drawing on her life as an indigenous botanist, Robin Wall Kimmerer weaves together scientific inquiry and native wisdom to celebrate our sacred reciprocal relationship with the natural world.",
    totalCopies: 3,
    copies: 3,
    quantity: 3,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-10-20T16:00:00Z"),
  },
  {
    title: "Before the Coffee Gets Cold",
    author: "Toshikazu Kawaguchi",
    category: "Fiction",
    image: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
    description: "In a quiet Tokyo alley, an ancient café offers its patrons a legendary opportunity to travel back in time, provided they return before their cup of freshly poured coffee grows cold.",
    totalCopies: 3,
    copies: 3,
    quantity: 3,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-10-25T11:45:00Z"),
  },
  {
    title: "A Brief History of Time",
    author: "Stephen Hawking",
    category: "Science",
    image: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600",
    description: "A landmark volume exploring profound cosmological questions about the creation of the universe, black holes, theoretical physics, and the ultimate nature of time and gravity.",
    totalCopies: 4,
    copies: 4,
    quantity: 4,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-10-28T08:30:00Z"),
  },
  {
    title: "Guns, Germs, and Steel",
    author: "Jared Diamond",
    category: "History",
    image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600",
    description: "A comprehensive examination of global human societies across 13,000 years, exploring how geographical and environmental factors shaped the modern balance of civilizations.",
    totalCopies: 2,
    copies: 2,
    quantity: 2,
    addedBy: "curator@booknook.library",
    addedByEmail: "curator@booknook.library",
    userEmail: "curator@booknook.library",
    addedByName: "Head Curator",
    userName: "Head Curator",
    createdAt: new Date("2026-11-01T13:20:00Z"),
  },
];

async function seed() {
  try {
    const { db, client } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const count = await booksCollection.countDocuments();
    if (count > 0) {
      console.log(`Database already has ${count} books. Skipping seed.`);
      process.exit(0);
    }

    const result = await booksCollection.insertMany(SEED_BOOKS);
    console.log(`Successfully seeded ${result.insertedCount} books into MongoDB!`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
