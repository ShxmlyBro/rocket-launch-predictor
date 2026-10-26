import os
import time
import pandas as pd
import requests
from tqdm import tqdm

# --- CONFIGURATION ---
GCAT_FILE = 'gcat.csv'
SITES_FILE = 'sites.tsv'
OUTPUT_FILE = 'merged_gcat_meteo.csv'
CHECKPOINT_INTERVAL = 500
RATE_LIMIT_DELAY = 0.5  # Seconds between requests

def load_and_merge_data():
    print("Loading datasets...")
    gcat_df = pd.read_csv(GCAT_FILE, low_memory=False)
    sites_df = pd.read_csv(SITES_FILE, sep='\t', low_memory=False)
    
    # Clean up sites_df coordinates to ensure they are numeric
    sites_df['Latitude'] = pd.to_numeric(sites_df['Latitude'], errors='coerce')
    sites_df['Longitude'] = pd.to_numeric(sites_df['Longitude'], errors='coerce')
    
    # Merge GCAT with Sites using 'Launch_Site' from GCAT and '#Site' from sites.tsv
    df = gcat_df.merge(
        sites_df[['#Site', 'Latitude', 'Longitude']], 
        left_on='Launch_Site', 
        right_on='#Site', 
        how='left'
    )
    
    initial_count = len(df)
    
    # Drop rows with missing dates or coordinates
    df = df.dropna(subset=['Launch_Date', 'Latitude', 'Longitude'])
    
    # Convert dates to datetime objects and filter out pre-1940 launches
    df['Launch_Date'] = pd.to_datetime(df['Launch_Date'], errors='coerce')
    df = df.dropna(subset=['Launch_Date'])
    df = df[df['Launch_Date'].dt.year >= 1940]
    
    # Format dates to YYYY-MM-DD for the Open-Meteo API
    df['Launch_Date'] = df['Launch_Date'].dt.strftime('%Y-%m-%d')
    
    print(f"Total rows in GCAT: {initial_count}")
    print(f"Valid rows for API (Post-1940 with coordinates): {len(df)}")
    return df.reset_index(drop=True)

def fetch_weather(lat, lon, date):
    """Queries Open-Meteo Historical Weather API."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date,
        "end_date": date,
        "daily": ["temperature_2m_mean", "precipitation_sum", "wind_speed_10m_max"],
        "timezone": "UTC"
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json().get('daily', {})
            return {
                'temp_mean': data.get('temperature_2m_mean', [None])[0],
                'precipitation': data.get('precipitation_sum', [None])[0],
                'max_wind': data.get('wind_speed_10m_max', [None])[0],
                'status': 'SUCCESS'
            }
        elif response.status_code == 429:
            time.sleep(5)  # Back off if rate limited
            return {'status': 'RATE_LIMITED'}
        else:
            return {'status': f'FAILED_{response.status_code}'}
    except Exception as e:
        return {'status': f'ERROR_{type(e).__name__}'}

def main():
    if not os.path.exists(SITES_FILE):
        print(f"ERROR: {SITES_FILE} not found in workspace!")
        return

    df = load_and_merge_data()
    
    print("\nStarting full batch processing. This may take several hours...")
    print("Ensure your machine does not go to sleep during execution.")
    
    temps, precips, winds, statuses = [], [], [], []
    successful_merges = 0

    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Fetching Weather"):
        weather = fetch_weather(row['Latitude'], row['Longitude'], row['Launch_Date'])
        
        temps.append(weather.get('temp_mean'))
        precips.append(weather.get('precipitation'))
        winds.append(weather.get('max_wind'))
        statuses.append(weather.get('status'))
        
        if weather.get('status') == 'SUCCESS':
            successful_merges += 1

        time.sleep(RATE_LIMIT_DELAY)

        # Checkpointing
        if (idx + 1) % CHECKPOINT_INTERVAL == 0 or (idx + 1) == len(df):
            df_out = df.iloc[:idx+1].copy()
            df_out['temp_mean'] = temps
            df_out['precipitation'] = precips
            df_out['max_wind_speed'] = winds
            df_out['api_status'] = statuses
            df_out.to_csv(OUTPUT_FILE, index=False)
            tqdm.write(f"Checkpoint saved: {idx + 1} records.")

    print("\n--- Pipeline Complete ---")
    print(f"Total Processed: {len(df)}")
    print(f"Successfully Enriched: {successful_merges}")

if __name__ == "__main__":
    main()
