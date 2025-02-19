from flask import Flask
from flask_cors import CORS
from routes import routes  # Import the routes blueprint
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes (for development)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_secret_key')  # Use environment variable
app.config['DATABASE'] = 'database.db' # Database file
#app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-string')

# Initialize Database (Run this *once* to create tables)
from models import db, init_db
with app.app_context():
    db.init_app(app) #Initialize the database
    if not os.path.exists('database.db'):
        init_db()

app.register_blueprint(routes)  # Register the routes

if __name__ == '__main__':
    app.run(debug=True)
