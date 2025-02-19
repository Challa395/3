from flask_sqlalchemy import SQLAlchemy
from flask import Flask
import uuid
from sqlalchemy.dialects.postgresql import UUID
from werkzeug.security import generate_password_hash, check_password_hash


db = SQLAlchemy()

def generate_uuid():
    return str(uuid.uuid4())

def init_db():
    db.create_all()


class User(db.Model):
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    name = db.Column(db.String(100), nullable=True)
    bio = db.Column(db.Text, nullable=True)

    skills_offered = db.relationship('Skill', secondary='user_skills_offered', backref='users_offering')
    skills_wanted = db.relationship('Skill', secondary='user_skills_wanted', backref='users_wanting')
    skill_ratings = db.relationship('SkillRating', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'


class Skill(db.Model):
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(50), unique=True, nullable=False)

    def __repr__(self):
        return f'<Skill {self.name}>'


# Association Tables
user_skills_offered = db.Table('user_skills_offered', db.Model.metadata,
    db.Column('user_id', UUID(as_uuid=True), db.ForeignKey('user.id'), primary_key=True),
    db.Column('skill_id', UUID(as_uuid=True), db.ForeignKey('skill.id'), primary_key=True)
)

user_skills_wanted = db.Table('user_skills_wanted', db.Model.metadata,
    db.Column('user_id', UUID(as_uuid=True), db.ForeignKey('user.id'), primary_key=True),
    db.Column('skill_id', UUID(as_uuid=True), db.ForeignKey('skill.id'), primary_key=True)
)


class SkillRating(db.Model):
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), nullable=False)
    skill_id = db.Column(UUID(as_uuid=True), db.ForeignKey('skill.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # e.g., 1-5
    skill = db.relationship('Skill', backref=db.backref('skill_ratings', lazy=True))
    __table_args__ = (db.UniqueConstraint('user_id', 'skill_id', name='_user_skill_uc'),) #Ensure skill rating is unique per user

    def __repr__(self):
        return f'<SkillRating user_id={self.user_id} skill_id={self.skill_id} rating={self.rating}>'


class TestQuestion(db.Model):
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    skill_id = db.Column(UUID(as_uuid=True), db.ForeignKey('skill.id'), nullable=False)
    question = db.Column(db.String(255), nullable=False)
    correct_answer = db.Column(db.String(255), nullable=False)  # Store the correct answer (or a hash of it)
    difficulty = db.Column(db.String(20), nullable=False)  # e.g., 'basic', 'medium', 'hard'

    skill = db.relationship('Skill', backref=
