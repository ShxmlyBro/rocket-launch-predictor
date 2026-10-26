import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import LaunchSchedule from "./components/LaunchSchedule";
import AstronautList from "./components/AstronautList";
import EventsList from "./components/EventsList";
import "./App.css";

const HeroContent = () => {
  const location = useLocation();
  const path = location.pathname;

  const getHeroContent = () => {
    switch (path) {
      case "/astronauts":
        return {
          title: "Space Explorers",
          description:
            "Discover the brave astronauts who venture into space, their missions, and achievements.",
        };
      case "/events":
        return {
          title: "Space Events",
          description:
            "Stay updated with the latest space events, launches, spacewalks, and other significant milestones.",
        };
      default:
        return {
          title: "Space Launch Schedule",
          description:
            "Track upcoming space launches and weather conditions with ease!",
        };
    }
  };

  const content = getHeroContent();

  return (
    <div className="hero">
      <div className="container text-center text-white">
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
    </div>
  );
};

const AboutContent = () => {
  const location = useLocation();
  const path = location.pathname;

  const getAboutContent = () => {
    switch (path) {
      case "/astronauts":
        return {
          title: "About Our Astronauts",
          description:
            "Our comprehensive astronaut database provides detailed information about space explorers from various space agencies worldwide. Track their missions, spacewalks, and achievements in space exploration. Stay informed about both active and retired astronauts who have contributed to humanity's space journey.",
        };
      case "/events":
        return {
          title: "About Space Events",
          description:
            "Our space events tracker keeps you informed about significant moments in space exploration. From rocket launches to spacewalks, docking events to mission milestones, we provide comprehensive coverage of space-related events worldwide. Watch live streams, access detailed information, and never miss an important space event.",
        };
      default:
        return {
          title: "About Space Launch Schedule",
          description:
            "Space Launch Schedule is your go-to platform for tracking upcoming space launches and their predicted weather conditions. We provide real-time updates on launches from various space agencies and companies worldwide, helping you stay connected with the latest developments in space exploration.",
        };
    }
  };

  const content = getAboutContent();

  return (
    <div id="about" className="container my-5">
      <h2>{content.title}</h2>
      <p>{content.description}</p>
    </div>
  );
};

function App() {
  return (
    <Router>
      <div>
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
          <div className="container">
            <a className="navbar-brand" href="/">
              Space Launch Schedule
            </a>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarNav"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarNav">
              <ul className="navbar-nav">
                <li className="nav-item">
                  <Link className="nav-link" to="/">
                    Launches
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/astronauts">
                    Astronauts
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/events">
                    Events
                  </Link>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="#about">
                    About
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </nav>

        <HeroContent />

        <div className="container my-5">
          <Routes>
            <Route path="/" element={<LaunchSchedule />} />
            <Route path="/astronauts" element={<AstronautList />} />
            <Route path="/events" element={<EventsList />} />
          </Routes>
        </div>

        <AboutContent />

        <footer className="bg-dark text-white py-3 text-center">
          <p>
            © {new Date().getFullYear()} Space Launch Schedule | Made with React
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
