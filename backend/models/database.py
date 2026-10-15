import os
from contextvars import ContextVar
from sqlalchemy import create_engine, Table, Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy import String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import DeclarativeBase, sessionmaker, relationship, backref

_session_var: ContextVar = ContextVar('db_session')


class _QueryProperty:
    """Adds .query to models exactly like Flask-SQLAlchemy does."""
    def __get__(self, obj, cls=None):
        if cls is None:
            return self
        try:
            return _session_var.get().query(cls)
        except LookupError:
            raise RuntimeError("No database session in context. Use inside a request.")


class Base(DeclarativeBase):
    query = _QueryProperty()


class _SessionProxy:
    """Proxies db.session.* calls to the current request-scoped session."""
    def get(self, model, pk):
        return _session_var.get().get(model, pk)

    def add(self, obj):
        _session_var.get().add(obj)

    def delete(self, obj):
        _session_var.get().delete(obj)

    def commit(self):
        _session_var.get().commit()

    def query(self, *args):
        return _session_var.get().query(*args)


def _make_table(name, *args, **kwargs):
    return Table(name, Base.metadata, *args, **kwargs)


class _DBCompat:
    """Drop-in replacement for Flask-SQLAlchemy's db object."""
    Model = Base
    session = _SessionProxy()

    Column = staticmethod(Column)
    Integer = Integer
    String = String
    Float = Float
    Boolean = Boolean
    DateTime = DateTime
    Text = Text
    JSON = JSON
    ForeignKey = staticmethod(ForeignKey)
    relationship = staticmethod(relationship)
    backref = staticmethod(backref)
    UniqueConstraint = staticmethod(UniqueConstraint)
    Table = staticmethod(_make_table)


db = _DBCompat()

# Junction tables
movie_list = _make_table(
    'movie_list',
    Column('movie_id', Integer, ForeignKey('movies.id'), primary_key=True),
    Column('list_id', Integer, ForeignKey('movielists.id'), primary_key=True),
)

show_list = _make_table(
    'show_list',
    Column('show_id', Integer, ForeignKey('shows.id'), primary_key=True),
    Column('list_id', Integer, ForeignKey('movielists.id'), primary_key=True),
)

club_members = _make_table(
    'club_members',
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('club_id', Integer, ForeignKey('clubs.id'), primary_key=True),
)

# Engine and session factory — initialised by main.py
engine = None
SessionLocal = None


def init_db(database_url: str):
    global engine, SessionLocal
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine
