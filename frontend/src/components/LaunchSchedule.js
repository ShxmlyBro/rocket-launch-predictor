import React, { useEffect, useState } from "react";
import LaunchCard from "./LaunchCard";
import axios from "axios";

const LaunchSchedule = () => {
  const [launches, setLaunches] = useState([]);
  const [weather, setWeather] = useState({});
  const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

  const coordinatesMap = {
    // United States
    "Cape Canaveral SFS": { lat: 28.4922, lon: -80.5772 },
    "Cape Canaveral Space Force Station": { lat: 28.4922, lon: -80.5772 },
    "Cape Canaveral": { lat: 28.4922, lon: -80.5772 },
    "CCSFS": { lat: 28.4922, lon: -80.5772 },
    "Kennedy Space Center": { lat: 28.5728, lon: -80.649 },
    "Vandenberg SFB": { lat: 34.742, lon: -120.5724 },
    "Wallops Flight Facility": { lat: 37.9401, lon: -75.4663 },
    "Spaceport America": { lat: 32.9903, lon: -106.9749 },
    "Pacific Spaceport Complex": { lat: 57.4356, lon: -152.3378 },

    // China
    "Jiuquan Satellite Launch Center": { lat: 40.9608, lon: 100.2861 },
    "Xichang Satellite Launch Center": { lat: 28.2463, lon: 102.0275 },
    "Wenchang Spacecraft Launch Site": { lat: 19.6145, lon: 110.951 },
    "Wenchang Satellite Launch Center": { lat: 19.6145, lon: 110.951 },
    "Taiyuan Satellite Launch Center": { lat: 38.8491, lon: 111.608 },
    "Yellow Sea": { lat: 35.0, lon: 123.0 },

    // Russia
    "Baikonur Cosmodrome": { lat: 45.9646, lon: 63.3052 },
    "Vostochny Cosmodrome": { lat: 51.8844, lon: 128.3341 },
    "Plesetsk Cosmodrome": { lat: 62.9271, lon: 40.5777 },

    // Europe
    "Guiana Space Center": { lat: 5.2322, lon: -52.7687 },
    "Esrange Space Center": { lat: 67.8927, lon: 21.1025 },

    // India
    "Satish Dhawan Space Centre": { lat: 13.7199, lon: 80.2304 },
    "Satish Dhawan": { lat: 13.7199, lon: 80.2304 },
    "SDSC": { lat: 13.7199, lon: 80.2304 },
    "Sriharikota": { lat: 13.7199, lon: 80.2304 },
    "Thumba Equatorial Rocket Launching Station": { lat: 8.5089, lon: 76.8722 },

    // Japan
    "Tanegashima Space Center": { lat: 30.3984, lon: 130.975 },
    "Uchinoura Space Center": { lat: 31.2514, lon: 131.0824 },

    // Others
    "Rocket Lab Launch Complex, Mahia Peninsula": { lat: -39.2622, lon: 177.8647 },
    "Naro Space Center": { lat: 34.4311, lon: 127.5350 },
    "Alcantara Launch Center": { lat: -2.3731, lon: -44.3962 },
    "Imam Khomeini Spaceport": { lat: 35.2347, lon: 53.9205 },
    "Shahroud Missile Test Site": { lat: 36.2003, lon: 55.3194 },
    "Palmachim Airbase": { lat: 31.8838, lon: 34.6805 },
    "Sohae Satellite Launching Station": { lat: 39.6602, lon: 124.7052 },
    "Sea Launch Platform": { lat: 0.0, lon: -154.0 },
    "Corn Ranch Spaceport": { lat: 32.8422, lon: -101.3936 },
  };

  const getLocationCoordinates = (launchSite) => {
    return coordinatesMap[launchSite];
  };

  const fetchWeatherData = async (location, launchDate) => {
    try {
      const coordinates = getLocationCoordinates(location);
      let lat, lon;

      if (!coordinates) {
        console.log(
          `No predefined coordinates for ${location}, attempting geocoding...`
        );
        const geoResponse = await axios.get(
          `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
            location
          )}&limit=1&appid=${WEATHER_API_KEY}`
        );

        if (!geoResponse.data.length) {
          console.log(`Location not found: ${location}`);
          return { condition: "No data", temp: null };
        }

        ({ lat, lon } = geoResponse.data[0]);
        console.log(`Geocoding result for ${location}: (${lat}, ${lon})`);
      } else {
        ({ lat, lon } = coordinates);
        console.log(
          `Using predefined coordinates for ${location}: (${lat}, ${lon})`
        );
      }

      // Get current weather instead of forecast
      const weatherResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`
      );

      const weatherInfo = {
        condition: weatherResponse.data.weather[0].main,
        temp: Math.round(weatherResponse.data.main.temp),
        coordinates: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        location: location,
      };

      console.log(`Weather for ${location}:`, weatherInfo);
      return weatherInfo;
    } catch (error) {
      console.error(`Error fetching weather for ${location}:`, error);
      return { condition: "Error", temp: null };
    }
  };

  useEffect(() => {
    const fetchLaunchesAndWeather = async () => {
      try {
        const { data } = await axios.get(
          "https://fdo.rocketlaunch.live/json/launches/next/5"
        );
        setLaunches(data.result);

        const weatherData = {};
        for (const launch of data.result) {
          if (launch.pad?.location?.name) {
            const weatherInfo = await fetchWeatherData(
              launch.pad.location.name,
              launch.sort_date
            );
            weatherData[launch.id] = weatherInfo;
          }
        }
        setWeather(weatherData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchLaunchesAndWeather();

    const interval = setInterval(fetchLaunchesAndWeather, 600000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  return (
    <div className="container">
      <h1 className="my-4">Upcoming Launches</h1>
      <div className="row">
        {launches.map((launch) => (
          <div key={launch.id} className="col-md-6 col-lg-4">
            <LaunchCard
              launch={launch}
              weather={
                weather[launch.id] || { condition: "Loading...", temp: null }
              }
              location={launch.pad.location.name}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LaunchSchedule;
