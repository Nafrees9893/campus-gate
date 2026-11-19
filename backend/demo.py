"""Create fictional reception records once, inside a single transaction."""

from datetime import datetime, timedelta
from .store import CAMPUS, db, password_hash

PEOPLE = [
    ("Amaya Perera", "Lakeside College"),
    ("Ravi Kumar", "Ceylon Field Lab"),
    ("Nila Fernando", "Independent"),
    ("Dilan Silva", "Campus Supplies"),
    ("Meera Suresh", "Eastern Design Studio"),
    ("Areeb Hassan", "Greenleaf Research"),
    ("Tara Wijesinghe", "Northshore Institute"),
    ("Kavin Raj", "Alumni Association"),
    ("Sana Iqbal", "Civic Arts Council"),
    ("Devika Dias", "Lakeside College"),
]
HOSTS = [
    ("Dr. Ishara Sen", "ishara", "Faculty of Technology"),
    ("Prof. Arun Nathan", "arun", "Engineering"),
    ("Ms. Nimali Jayasuriya", "nimali", "Student Affairs"),
    ("Mr. Farhan Ali", "farhan", "Administration"),
]
PURPOSES = [
    "Research meeting",
    "Laboratory visit",
    "Admissions enquiry",
    "Equipment delivery",
    "Project discussion",
]


def seed():
    with db() as con:
        con.execute("BEGIN IMMEDIATE")
        if con.execute("SELECT count(*) FROM users").fetchone()[0]:
            return
        for name, email, role in [
            ("Demo Administrator", "admin@campus.test", "admin"),
            ("Reception Desk", "desk@campus.test", "user"),
        ]:
            con.execute(
                "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
                (name, email, password_hash("CampusDemo!2026"), role),
            )
        people = [
            con.execute(
                "INSERT INTO visitors(name,email,organization) VALUES(?,?,?)",
                (name, f"visitor{i+1}@example.test", org),
            ).lastrowid
            for i, (name, org) in enumerate(PEOPLE)
        ]
        hosts = [
            con.execute(
                "INSERT INTO hosts(name,email,department) VALUES(?,?,?)",
                (name, mail + "@example.test", dept),
            ).lastrowid
            for name, mail, dept in HOSTS
        ]
        current = datetime.now(CAMPUS)
        for i, days in enumerate([32, 20, 12, 7, 5, 4, 3, 2, 1, 0, 0, 0, 0]):
            minutes = (13 - i) * 10 if days == 0 else 0
            # Today's sample arrivals always fit between local midnight and now.
            elapsed = (
                current - current.replace(hour=0, minute=0, second=0, microsecond=0)
            ).total_seconds()
            arrival = current - timedelta(
                days=days, seconds=min(minutes * 60, elapsed * (13 - i) / 6)
            )
            departure = (
                min(current, arrival + timedelta(minutes=35)) if i < 11 else None
            )
            con.execute(
                "INSERT INTO visits(visitor_id,host_id,purpose,check_in,check_out) VALUES(?,?,?,?,?)",
                (
                    people[i % len(people)],
                    hosts[i % len(hosts)],
                    PURPOSES[i % len(PURPOSES)],
                    arrival.isoformat(timespec="seconds"),
                    departure.isoformat(timespec="seconds") if departure else None,
                ),
            )
