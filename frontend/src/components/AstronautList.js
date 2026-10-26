import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../assets/AstronautList.css';
import Loader from './Loader';

const AstronautList = () => {
  const [astronauts, setAstronauts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const defaultImageUrl = 'https://via.placeholder.com/300x400?text=Astronaut';

  useEffect(() => {
    const fetchAstronauts = async () => {
      try {
        const response = await axios.get('https://ll.thespacedevs.com/2.3.0/astronauts/');
        setAstronauts(response.data.results);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch astronaut data');
        setLoading(false);
      }
    };

    fetchAstronauts();
  }, []);

  if (loading) return <Loader />;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="astronaut-grid">
      {astronauts.map((astronaut) => (
        <div key={astronaut.id} className="astronaut-card">
          <div className="astronaut-image">
            <img 
              src={astronaut.image?.thumbnail_url || defaultImageUrl} 
              alt={astronaut.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = defaultImageUrl;
              }}
            />
          </div>
          <div className="astronaut-info">
            <h3>{astronaut.name}</h3>
            <div className="status-badge" data-status={astronaut.status.name.toLowerCase()}>
              {astronaut.status.name}
            </div>
            <p className="agency">{astronaut.agency?.name || 'Independent'}</p>
            <div className="stats">
              <div className="stat">
                <span className="label">Nationality:</span>
                <span>{astronaut.nationality?.[0]?.name || 'Unknown'}</span>
              </div>
              <div className="stat">
                <span className="label">Flights:</span>
                <span>{astronaut.flights_count}</span>
              </div>
              <div className="stat">
                <span className="label">Spacewalks:</span>
                <span>{astronaut.spacewalks_count}</span>
              </div>
            </div>
            {astronaut.bio && (
              <div className="bio">
                <p>{astronaut.bio.substring(0, 150)}...</p>
              </div>
            )}
            <div className="social-links">
              {astronaut.social_media_links?.map((link) => (
                <a 
                  key={link.id} 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`social-icon ${link.social_media.name.toLowerCase()}`}
                >
                  {link.social_media.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AstronautList; 