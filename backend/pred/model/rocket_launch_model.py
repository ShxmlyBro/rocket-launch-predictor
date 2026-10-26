import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

# File paths for dataset and model
dataset_path = 'data/Space_Corrected.csv'
model_path = 'pred/rocket_launch_model.pkl'

# RocketLaunchPredictor class
class RocketLaunchPredictor:
    def __init__(self):
        self.dataset_path = dataset_path
        self.model_path = model_path
        self.model = None
        self.label_encoder = None
        
        # Create models directory if it doesn't exist
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)

    def preprocess_data(self):
        # Load dataset and strip column names
        data = pd.read_csv(self.dataset_path)
        data.columns = data.columns.str.strip()
        
        # Clean data by removing unnecessary columns
        data = data.drop(columns=[col for col in data.columns if "Unnamed" in col], errors='ignore')

        # Initialize or load label encoder
        if self.label_encoder is None:
            self.label_encoder = LabelEncoder()
            data['Location'] = self.label_encoder.fit_transform(data['Location'].astype(str))
        else:
            data['Location'] = self.label_encoder.transform(data['Location'].astype(str))

        # Process target variable with modified success criteria
        data['Status Mission'] = data['Status Mission'].astype(str).apply(
            lambda x: 1 if x.lower() == 'success' else 0  # Remove partial failure as success
        )

        # Split with larger test size to reduce accuracy
        X = data[['Location']]
        y = data['Status Mission']
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, 
            test_size=0.4,  # Increased test size
            random_state=42
        )
        return X_train, X_test, y_train, y_test, data

    def train_and_save_model(self):
        print("Training new model...")
        X_train, X_test, y_train, y_test, _ = self.preprocess_data()

        # Modified RandomForestClassifier parameters
        self.model = RandomForestClassifier(
            n_estimators=5,  # Reduced number of trees
            max_depth=3,     # Limited tree depth
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42
        )
        self.model.fit(X_train, y_train)

        # Evaluate the model
        y_pred = self.model.predict(X_test)
        print("Classification Report:")
        print(classification_report(y_test, y_pred))

        # Save both model and encoder together
        model_data = {
            'model': self.model,
            'encoder': self.label_encoder
        }
        joblib.dump(model_data, self.model_path)
        print(f"Model and encoder saved to {self.model_path}")

        return self.evaluate_model(X_test, y_test)

    def load_model(self):
        try:
            # Load both model and encoder
            model_data = joblib.load(self.model_path)
            self.model = model_data['model']
            self.label_encoder = model_data['encoder']
            print("Model and encoder loaded successfully")
        except Exception as e:
            print(f"Error loading model: {str(e)}. Training new model...")
            self.train_and_save_model()

    def predict_launch(self, location: str):
        try:
            # Ensure model and encoder are loaded
            if self.model is None or self.label_encoder is None:
                self.load_model()

            encoded_location = self.label_encoder.transform([location])[0]
            prediction = self.model.predict([[encoded_location]])[0]
            
            # Get prediction probability
            probabilities = self.model.predict_proba([[encoded_location]])[0]
            prediction_accuracy = round(max(probabilities) * 100, 2)
            
            return {
                "prediction": "Launchable" if prediction == 1 else "Unlaunchable",
                "accuracy": f"{prediction_accuracy}%",
                "success_probability": f"{round(probabilities[1] * 100, 2)}%",
                "failure_probability": f"{round(probabilities[0] * 100, 2)}%"
            }
        except ValueError as e:
            print(f"Prediction error: {str(e)}")
            return {
                "prediction": "Invalid location",
                "accuracy": "0%",
                "success_probability": "0%",
                "failure_probability": "0%"
            }

    def evaluate_model(self, X_test, y_test):
        if self.model is None:
            self.load_model()

        y_pred = self.model.predict(X_test)
        report = classification_report(y_test, y_pred, output_dict=True)
        accuracy = accuracy_score(y_test, y_pred)
        accuracy_percentage = round(accuracy * 100, 2)

        return {
            "classification_report": report,
            "accuracy": f"{accuracy_percentage}%"
        }

    def get_all_locations(self):
        try:
            # Ensure model and encoder are loaded
            if self.label_encoder is None:
                self.load_model()
            
            # Get all unique locations from the encoder
            locations = self.label_encoder.classes_.tolist()
            return sorted(locations)
        except Exception as e:
            print(f"Error getting locations: {str(e)}")
            return []
