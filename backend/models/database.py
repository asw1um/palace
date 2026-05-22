from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

movie_list = db.Table('movie_list',
    db.Column('movie_id', db.Integer, db.ForeignKey('movies.id'), primary_key=True),
    db.Column('list_id', db.Integer, db.ForeignKey('movielists.id'), primary_key=True)
)

show_list = db.Table('show_list',
    db.Column('show_id', db.Integer, db.ForeignKey('shows.id'), primary_key=True),
    db.Column('list_id', db.Integer, db.ForeignKey('movielists.id'), primary_key=True)
)

club_members = db.Table('club_members',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('club_id', db.Integer, db.ForeignKey('clubs.id'), primary_key=True)
)
