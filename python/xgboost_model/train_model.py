import os
from pathlib import Path

import pandas as pd
import xgboost as xgb

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parents[1]
DEFAULT_CSV_PATH = BASE_DIR / 'input' / 'steam_data.csv'
DEFAULT_MODEL_PATH = REPO_ROOT / 'packages' / 'lib' / 'steam_model.json'

def load_data(csv_file: Path):
    if not csv_file.exists():
        raise FileNotFoundError(f'Dataset not found at {csv_file}')

    df = pd.read_csv(csv_file)
    # Assumes you have manually added an 'ownership' target column
    df = df.dropna(subset=['ownership'])
    return df

def preprocess_data(df: pd.DataFrame):
    # Ensure is_free is a boolean
    df['is_free'] = df['is_free'].map({'True': True, 'False': False})
    # Convert price column to numeric so fillna works without downcasting warnings
    if 'price' in df.columns:
        df['price'] = pd.to_numeric(df['price'], errors='coerce')
    # Parse the release_date field into a datetime and convert to a numeric timestamp
    df['release_date_parsed'] = pd.to_datetime(df['release_date'], errors='coerce')
    df['release_date_numeric'] = (df['release_date_parsed'] - pd.Timestamp("1970-01-01")) // pd.Timedelta('1s')
    # Filter out rows where game is not free but has no price
    df = df[~((df['is_free'] == False) & ((df['price'].isnull()) | (df['price'] == "")))]
    # Remove non-feature columns: app_id, ownership, and the original release_date and parsed date column
    X = df.drop(columns=['app_id', 'release_date', 'ownership', 'release_date_parsed'])
    y = df['ownership']
    # Fill missing numeric values
    X = X.fillna(-1)
    # Convert boolean columns to integers for XGBoost compatibility
    X['is_free'] = X['is_free'].astype(int)
    return X, y

def train_model(X: pd.DataFrame, y: pd.Series):
    # DMatrix keeps training lightweight on constrained environments
    dtrain = xgb.DMatrix(X, label=y)
    params = {
        'objective': 'reg:squarederror',
        'eval_metric': 'rmse',
    }
    return xgb.train(params, dtrain, num_boost_round=100)

def save_model(model: xgb.Booster, filename: Path):
    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(output_path))

def main():
    print('Current working directory:', os.getcwd())

    csv_file = Path(os.environ.get('TRAINING_DATA_PATH', DEFAULT_CSV_PATH))
    model_output = Path(os.environ.get('MODEL_OUTPUT_PATH', DEFAULT_MODEL_PATH))

    print('Loading training data from:', csv_file)
    print('Saving trained model to:', model_output)

    df = load_data(csv_file)
    X, y = preprocess_data(df)
    # Split data into training and testing sets
    # X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    X_train = X
    y_train = y
    model = train_model(X_train, y_train)
    # Evaluate the model on the test set
    # predictions = model.predict(X_test)
    # rmse = root_mean_squared_error(y_test, predictions)
    # Compute relative RMSE and R2 score
    # relative_rmse = (rmse / y_test.mean()) * 100
    # print(f"Test RMSE: {rmse} (which is {relative_rmse:.2f}% of mean ownership)")
    # print(f"R2 score: {r2}")
    save_model(model, model_output)
    print("Model training complete. Model saved to steam_model.json")

if __name__ == '__main__':
    main()
