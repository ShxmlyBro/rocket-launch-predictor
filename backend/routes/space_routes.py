from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

import space_service

spaceRouter = APIRouter(prefix="/space")


class _Envelope(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    stale: bool
    as_of: Optional[str] = None
    note: Optional[str] = Field(None, alias="_note")


class Astronaut(BaseModel):
    name: Optional[str] = None
    nationality: Optional[str] = None
    agency: Optional[str] = None
    status: Optional[str] = None
    image_url: Optional[str] = None
    bio: str = ""


class Event(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    date: Optional[str] = None
    description: str = ""
    agencies: List[str] = []
    info_url: Optional[str] = None


class Mission(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    mission_description: str = ""
    rocket: Optional[str] = None
    provider: Optional[str] = None


class Article(BaseModel):
    title: Optional[str] = None
    source: Optional[str] = None
    published_at: Optional[str] = None
    summary: str = ""
    url: Optional[str] = None


class IssPosition(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    velocity: Optional[float] = None
    visibility: Optional[str] = None
    timestamp: Optional[int] = None


class AstronautsResponse(_Envelope):
    items: List[Astronaut]


class EventsResponse(_Envelope):
    items: List[Event]


class MissionsResponse(_Envelope):
    items: List[Mission]


class NewsResponse(_Envelope):
    items: List[Article]


class IssResponse(_Envelope):
    data: IssPosition


_opts = dict(response_model_by_alias=True, response_model_exclude_none=True)


@spaceRouter.get("/astronauts", response_model=AstronautsResponse, **_opts)
def astronauts():
    return space_service.get_astronauts()


@spaceRouter.get("/events", response_model=EventsResponse, **_opts)
def events():
    return space_service.get_events()


@spaceRouter.get("/missions", response_model=MissionsResponse, **_opts)
def missions():
    return space_service.get_missions()


@spaceRouter.get("/news", response_model=NewsResponse, **_opts)
def news():
    return space_service.get_news()


@spaceRouter.get("/iss", response_model=IssResponse, **_opts)
def iss():
    return space_service.get_iss()
