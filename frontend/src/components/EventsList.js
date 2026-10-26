import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../assets/EventsList.css';
import Loader from './Loader';

const EventCard = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  const defaultImageUrl = 'https://via.placeholder.com/300x200?text=Space+Event';

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  return (
    <div 
      className={`event-card ${expanded ? 'expanded' : ''}`}
      onClick={toggleExpand}
    >
      <div className="event-image">
        <img 
          src={event.image?.thumbnail_url || defaultImageUrl} 
          alt={event.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = defaultImageUrl;
          }}
        />
        {event.webcast_live && (
          <div className="live-badge">
            🔴 LIVE
          </div>
        )}
      </div>
      <div className="event-info">
        <div className="event-header">
          <h3>{event.name}</h3>
          <span className="event-type">{event.type?.name}</span>
        </div>
        <div className="event-details">
          <div className="detail-item">
            <span className="label">Date:</span>
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="detail-item">
            <span className="label">Location:</span>
            <span>{event.location || 'Location TBD'}</span>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="expanded-content">
            {event.description && (
              <div className="event-description">
                <h4>Description</h4>
                <p>{event.description}</p>
              </div>
            )}
            <div className="event-links">
              {event.info_urls?.map((info, index) => (
                <a 
                  key={index}
                  href={info.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  {info.title || 'More Info'}
                </a>
              ))}
              {event.vid_urls?.map((vid, index) => (
                <a 
                  key={index}
                  href={vid.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="video-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className="fas fa-video"></i> Watch Video
                </a>
              ))}
            </div>
            <div className="expand-indicator">
              Click to collapse
            </div>
          </div>
        )}
        {!expanded && (
          <div className="expand-indicator">
            Click for more details
          </div>
        )}
      </div>
    </div>
  );
};

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get('https://ll.thespacedevs.com/2.3.0/events/');
        setEvents(response.data.results);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch events data');
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) return <Loader />;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="events-grid">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};

export default EventsList; 