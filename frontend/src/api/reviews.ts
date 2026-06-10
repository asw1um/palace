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
  is_spoiler?:boolean;
  author?: { id: number; username: string; nickname: string | null; profile_picture: string | null };
  reactions?: { likes: number; dislikes: number; my_reaction: 'like' | 'dislike' | null };
}

export async function upsert_review(data: {
  tmdb_id: number;
  media_type: string;
  title?: string;
  poster_url?: string;
  rating?: number | null;
  content?: string;
  is_spoiler?: boolean
}): Promise<Review> {
  const res = await client.post('/reviews', data);
  return res.data.review;
}

export async function delete_review(review_id: number): Promise<void> {
  await client.delete(`/reviews/${review_id}`);
}

export async function get_title_reviews(tmdb_id: number, media_type: string): Promise<Review[]> {
  const res = await client.get(`/reviews/title/${tmdb_id}/${media_type}`);
  return res.data.reviews || [];
}

export async function get_my_review(tmdb_id: number, media_type: string): Promise<Review | null> {
  const res = await client.get(`/reviews/me/${tmdb_id}/${media_type}`);
  return res.data.review;
}

export async function get_user_reviews(user_id: number): Promise<Review[]> {
  const res = await client.get(`/reviews/user/${user_id}`);
  return res.data.reviews || [];
}

export async function react_to_review(review_id: number, reaction: 'like' | 'dislike'): Promise<'like' | 'dislike' | null> {
  const res = await client.post(`/reviews/${review_id}/react`, { reaction });
  return res.data.current_reaction ?? null;
}
