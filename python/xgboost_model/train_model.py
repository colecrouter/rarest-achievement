import os
from pathlib import Path

import xgboost as xgb

from training_utils import load_training_data, select_features, train_booster

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parents[1]
DEFAULT_CSV_PATH = BASE_DIR / 'input' / 'steam_data.csv'
DEFAULT_MODEL_PATH = REPO_ROOT / 'packages' / 'lib' / 'steam_model.json'

def save_model(model: xgb.Booster, filename: Path):
    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(output_path))

def main():
    print('Current working directory:', os.getcwd())

    csv_file = Path(os.environ.get('TRAINING_DATA_PATH', DEFAULT_CSV_PATH))
    model_output = Path(os.environ.get('MODEL_OUTPUT_PATH', DEFAULT_MODEL_PATH))
    feature_set = os.environ.get('MODEL_FEATURE_SET', 'current')
    target_transform = os.environ.get('MODEL_TARGET_TRANSFORM', 'log1p')

    print('Loading training data from:', csv_file)
    print('Saving trained model to:', model_output)
    print('Feature set:', feature_set)
    print('Target transform:', target_transform)

    df = load_training_data(csv_file)
    X, y = select_features(df, feature_set)
    model = train_booster(X, y, target_transform)
    model.set_attr(target_transform=target_transform, feature_set=feature_set)
    save_model(model, model_output)
    print("Model training complete. Model saved to steam_model.json")

if __name__ == '__main__':
    main()
