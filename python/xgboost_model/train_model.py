import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import root_mean_squared_error

def load_data(csv_file):
    df = pd.read_csv(csv_file)
    # Assumes you have manually added an 'ownership' target column
    df = df.dropna(subset=['ownership'])
    return df

def preprocess_data(df):
    # Ensure is_free is a boolean
    df['is_free'] = df['is_free'].map({'True': True, 'False': False})
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

def train_model(X, y):
    model = XGBRegressor(objective='reg:squarederror', n_estimators=100)
    model.fit(X, y)
    return model

def save_model(model, filename):
    model.save_model(filename)

def main():
    # Print current cwd
    import os
    print("Current working directory:", os.getcwd())

    csv_file = 'steam_data.csv'
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
    from sklearn.metrics import r2_score
    # r2 = r2_score(y_test, predictions)
    # print(f"Test RMSE: {rmse} (which is {relative_rmse:.2f}% of mean ownership)")
    # print(f"R2 score: {r2}")
    save_model(model, '../../packages/lib/steam_model.json')
    print("Model training complete. Model saved to steam_model.json")

if __name__ == '__main__':
    main()
