export const DEMO_PERSONAS = {
  mumbai_london: {
    id: "mumbai_london",
    label: "Mumbai → London",
    origin: "Mumbai",
    destination: "London",
    interests: ["A. R. Rahman", "Zindagi Na Milegi Dobara", "Leopold Cafe"],
    interestTypes: ["urn:entity:artist", "urn:entity:movie", "urn:entity:place"],
    budget: 2,
    pace: "balanced",
  },
  delhi_newyork: {
    id: "delhi_newyork",
    label: "Delhi → New York",
    origin: "Delhi",
    destination: "New York City",
    interests: ["Prateek Kuhad", "The Lunchbox", "Blue Tokai Coffee Roasters | Hauz Khas"],
    interestTypes: ["urn:entity:artist", "urn:entity:movie", "urn:entity:place"],
    budget: 2,
    pace: "adventurous",
  },
  bengaluru_berlin: {
    id: "bengaluru_berlin",
    label: "Bengaluru → Berlin",
    origin: "Bengaluru",
    destination: "Berlin",
    interests: ["The Local Train", "777 Charlie", "Koshy's"],
    interestTypes: ["urn:entity:artist", "urn:entity:movie", "urn:entity:place"],
    budget: 1,
    pace: "comforting",
  },
};

const BRIDGES = {
  London: {
    places: [
      ["Dishoom Shoreditch", "place", "Shoreditch, London", ["Bombay café", "social dining"], 0.94],
      ["Southbank Centre", "place", "South Bank, London", ["live music", "community"], 0.89],
      ["Regent's Park Open Air Theatre", "place", "Regent's Park, London", ["outdoors", "cinema energy"], 0.84],
    ],
    artists: [
      ["Nitin Sawhney", "artist", "London", ["South Asian fusion", "cinematic"], 0.92],
      ["Jasleen Kaur", "artist", "London", ["diaspora", "experimental"], 0.82],
    ],
    movies: [
      ["Rocks", "movie", "London", ["friendship", "city life"], 0.87],
      ["Blinded by the Light", "movie", "Luton / London", ["diaspora", "music"], 0.83],
    ],
  },
  "New York City": {
    places: [
      ["The Chai Spot", "place", "Nolita, New York", ["chai", "community"], 0.93],
      ["Bryant Park", "place", "Midtown Manhattan", ["urban park", "people watching"], 0.86],
      ["Nitehawk Cinema", "place", "Brooklyn, New York", ["independent film", "food"], 0.84],
    ],
    artists: [
      ["Raveena", "artist", "New York", ["indie", "South Asian diaspora"], 0.91],
      ["VÉRITÉ", "artist", "New York", ["intimate pop", "independent"], 0.80],
    ],
    movies: [
      ["The Namesake", "movie", "New York", ["diaspora", "belonging"], 0.90],
      ["Paterson", "movie", "New Jersey / New York", ["quiet city life", "human stories"], 0.81],
    ],
  },
  Berlin: {
    places: [
      ["Tempelhofer Feld", "place", "Neukölln, Berlin", ["open park", "community"], 0.91],
      ["Chutnify", "place", "Prenzlauer Berg, Berlin", ["South Indian", "casual"], 0.90],
      ["Lido Berlin", "place", "Kreuzberg, Berlin", ["indie music", "intimate venue"], 0.85],
    ],
    artists: [
      ["Parra for Cuva", "artist", "Berlin", ["indie electronic", "melodic"], 0.86],
      ["AnnenMayKantereit", "artist", "Germany", ["indie", "live band"], 0.82],
    ],
    movies: [
      ["Victoria", "movie", "Berlin", ["city discovery", "nightlife"], 0.84],
      ["Oh Boy", "movie", "Berlin", ["quiet urban life", "belonging"], 0.80],
    ],
  },
};

function demoEntity(tuple, index, group) {
  const [name, type, location, tags, score] = tuple;
  return {
    id: `demo-${group}-${index}`,
    name,
    type: `urn:entity:${type}`,
    subtype: "",
    description: "",
    image: null,
    location,
    score,
    tags,
    explainability: null,
  };
}

export function demoPlan(input) {
  const data = BRIDGES[input.destination];
  if (!data) throw new Error("Illustrative mode supports London, New York City, and Berlin. A Qloo key is required for other destinations.");
  const resolved = input.interests.map((name, index) => ({
    id: `demo-anchor-${index}`,
    name,
    type: index === 0 ? "urn:entity:artist" : index === 1 ? "urn:entity:movie" : "urn:entity:place",
    score: 1,
    tags: [],
  }));
  return {
    mode: "demo",
    resolved,
    groups: {
      places: data.places.map((item, index) => demoEntity(item, index, "place")),
      artists: data.artists.map((item, index) => demoEntity(item, index, "artist")),
      movies: data.movies.map((item, index) => demoEntity(item, index, "movie")),
    },
  };
}
