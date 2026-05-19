# Palace REST API

A Flask-based REST API for tracking movies and TV shows, and sharing collections with friends. Built around TMDB's API with social features like clubs, reviews, and activity feeds.

---

## Note on Frontend

The frontend is not included in this repository. It was built entirely with AI and has been removed to keep the focus on the backend. If you want to use this API with a frontend, you'll need to build one yourself.

---

## What's Implemented

- [x] **User Authentication** — JWT-based auth, signup/login, profile pictures, banners, bio
- [x] **Movie & TV Search** — Search via TMDB API, supports both movies and TV shows
- [x] **Lists** — Create and manage personal movie/TV lists, pin lists to dashboard
- [x] **Watchlist / Progress Tracking** — Track watch progress per movie or per episode for TV shows (with real episode data from TMDB)
- [x] **Clubs** — Create or join clubs, share lists, club admin and mod roles
- [x] **Reviews & Ratings** — Leave star ratings and written reviews on movies and TV shows
- [x] **Activity Log** — Per-user and global activity feed (joined clubs, created lists, left reviews, etc.)
- [x] **Notifications** — User notification system
- [x] **Settings** — Displayed list, pinned lists/clubs to dashboard, user preferences
- [x] **Discover / Trending** — Trending movies and shows pulled from TMDB

---

## Tech Stack

- **Framework**: Flask
- **Database**: SQLite with SQLAlchemy ORM
- **Authentication**: Flask-JWT-Extended
- **External API**: TMDB (The Movie Database)
- **CORS**: Enabled for cross-origin requests

---

## Setup & Installation

### Prerequisites

- Python 3.7+
- TMDB API key — get one free at [https://www.themoviedb.org](https://www.themoviedb.org)

### 1. Clone the Repository

```bash
git clone https://github.com/uhhhuser/palace.git
cd palace
```

### 2. Create a Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
TMDB_API_KEY=your_tmdb_api_key_here
JWT_SECRET_KEY=your_secret_key_here
```

### 5. Run the Application

```bash
python backend/app.py
```

The API will start at `http://localhost:5000`

---

## Future Ideas

- Discord OAuth integration
- Production database (PostgreSQL/MySQL)
- Friends list
- Advanced search filters — search by actor or director to find all their movies/shows
