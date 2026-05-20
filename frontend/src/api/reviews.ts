import client from './client';

export interface Review {
  id: number;
  user_id: number;
  tmdb_id: number;
  media_type: string;
  title: string;
  poster_url: string;
  rating: number | null;
  content: string;
  created_at: string;
  author?: { id: number; username: string; nickname: string | null; profile_picture: string | null };
}

export async function upsertReview(data: {
  tmdb_id: number;
  media_type: string;
  title?: string;
  poster_url?: string;
  rating?: number | null;
  content?: string;
}): Promise<Review> {
  const res = await client.post('/reviews', data);
  return res.data.review;
}

export async function deleteReview(reviewId: number): Promise<void> {
  await client.delete(`/reviews/${reviewId}`);
}

export async function getTitleReviews(tmdbId: number, mediaType: string): Promise<Review[]> {
  const res = await client.get(`/reviews/title/${tmdbId}/${mediaType}`);
  return res.data.reviews || [];
}

export async function getMyReview(tmdbId: number, mediaType: string): Promise<Review | null> {
  const res = await client.get(`/reviews/me/${tmdbId}/${mediaType}`);
  return res.data.review;
}

export async function getUserReviews(userId: number): Promise<Review[]> {
  const res = await client.get(`/reviews/user/${userId}`);
  return res.data.reviews || [];
}
