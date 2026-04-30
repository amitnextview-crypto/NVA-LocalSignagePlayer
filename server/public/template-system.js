(function () {
  const SOURCE_TYPE = "template";
  const TEMPLATE_LIBRARY_OVERRIDES_KEY = "template_library_overrides_v1";
  const TEMPLATE_ROW_GAP_MAX = 12;
  const TEMPLATE_ROW_BOX_MAX = 7.6;
  const TEMPLATE_ROW_ANCHORS = ["top", "middle", "bottom"];
  const TEMPLATE_FONT_OPTIONS = [
    {
      value: "system",
      label: "System UI",
      webFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    {
      value: "roboto",
      label: "Roboto",
      webFamily: '"Roboto", "Segoe UI", sans-serif',
    },
    {
      value: "segoe",
      label: "Segoe UI",
      webFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    },
    {
      value: "helvetica",
      label: "Helvetica",
      webFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    },
    {
      value: "georgia",
      label: "Georgia",
      webFamily: 'Georgia, "Times New Roman", serif',
    },
    {
      value: "times",
      label: "Times New Roman",
      webFamily: '"Times New Roman", Times, serif',
    },
    {
      value: "verdana",
      label: "Verdana",
      webFamily: "Verdana, Geneva, sans-serif",
    },
    {
      value: "trebuchet",
      label: "Trebuchet MS",
      webFamily: '"Trebuchet MS", Helvetica, sans-serif',
    },
    {
      value: "courier",
      label: "Courier New",
      webFamily: '"Courier New", Courier, monospace',
    },
    {
      value: "casual",
      label: "Casual",
      webFamily: '"Comic Sans MS", "Comic Sans", cursive',
    },
  ];
  const CATEGORY_DEFINITIONS = [
    {
      category: "Railway Station",
      accent: "#2f8bff",
      templates: [
        {
          slug: "departures-board",
          name: "Departures Board",
          layout: "schedule-board",
          title: "Central Junction Departures",
          subtitle: "Platform guidance for the next departures",
          badgeText: "On Time",
          rows: [
            { label: "Intercity Express", value: "09:35", meta: "Platform 4", status: "Boarding" },
            { label: "Metro Rapid", value: "09:42", meta: "Platform 1", status: "On Time" },
            { label: "Regional Line", value: "09:55", meta: "Platform 7", status: "Delayed 5m" },
          ],
        },
        {
          slug: "station-services",
          name: "Passenger Services",
          layout: "list-focus",
          title: "Station Services",
          subtitle: "Help passengers find the right counters faster",
          badgeText: "Passenger Info",
          rows: [
            { label: "Ticket Counter", value: "Open", meta: "Hall A", status: "Counter 3" },
            { label: "Waiting Lounge", value: "Level 1", meta: "AC seating", status: "Available" },
            { label: "Parcel Desk", value: "Gate 2", meta: "Bulk booking", status: "Till 22:00" },
          ],
        },
        {
          slug: "station-highlights",
          name: "Station Highlights",
          layout: "metric-cards",
          title: "Today At Central Junction",
          subtitle: "Quick operating snapshot",
          badgeText: "Operations",
          rows: [
            { label: "Trains Today", value: "142", meta: "Scheduled", status: "Active" },
            { label: "Platforms Active", value: "12", meta: "Live", status: "Open" },
            { label: "Help Desks", value: "5", meta: "Staffed now", status: "Ready" },
          ],
        },
      ],
    },
    {
      category: "Airport",
      accent: "#4b9cff",
      templates: [
        {
          slug: "flight-board",
          name: "Departures Board",
          layout: "schedule-board",
          title: "Terminal A Departures",
          subtitle: "Flight timings and gate assignments",
          badgeText: "Gate Updates",
          rows: [
            { label: "AI 642", value: "10:05", meta: "Gate 12", status: "Boarding" },
            { label: "6E 219", value: "10:20", meta: "Gate 7", status: "On Time" },
            { label: "UK 811", value: "10:45", meta: "Gate 3", status: "Security Open" },
          ],
        },
        {
          slug: "traveler-services",
          name: "Traveler Services",
          layout: "list-focus",
          title: "Airport Services",
          subtitle: "Key amenities for travelers",
          badgeText: "Guest Care",
          rows: [
            { label: "Check-in Help", value: "Zone B", meta: "Assisted counters", status: "Live" },
            { label: "Lounge Access", value: "Level 2", meta: "Premium seating", status: "Open" },
            { label: "Baggage Support", value: "Belt 5", meta: "Delayed bag claims", status: "Queue Low" },
          ],
        },
        {
          slug: "airport-performance",
          name: "Airport Snapshot",
          layout: "metric-cards",
          title: "Airport Snapshot",
          subtitle: "Operational highlights for this shift",
          badgeText: "Terminal Ops",
          rows: [
            { label: "Flights On Time", value: "92%", meta: "Today", status: "Strong" },
            { label: "Open Gates", value: "18", meta: "Current", status: "Ready" },
            { label: "Avg Security Wait", value: "09m", meta: "Domestic", status: "Normal" },
          ],
        },
      ],
    },
    {
      category: "Restaurant",
      accent: "#d76b2e",
      templates: [
        {
          slug: "signature-menu",
          name: "Signature Menu",
          layout: "price-board",
          title: "Chef's Signature Menu",
          subtitle: "Popular picks for lunch service",
          badgeText: "Chef Choice",
          rows: [
            { label: "Grilled Herb Chicken", price: "$14", meta: "With roasted vegetables", status: "Best Seller" },
            { label: "Creamy Pasta Bowl", price: "$12", meta: "Add garlic bread", status: "Fresh" },
            { label: "Garden Salad Combo", price: "$10", meta: "Includes beverage", status: "Light Pick" },
          ],
        },
        {
          slug: "offers-board",
          name: "Offers Board",
          layout: "list-focus",
          title: "Today's Restaurant Offers",
          subtitle: "Upsell combos and high-margin specials",
          badgeText: "Limited Time",
          rows: [
            { label: "Lunch Combo", value: "20% Off", meta: "12 PM - 3 PM", status: "Popular" },
            { label: "Dessert Add-on", value: "$4", meta: "With any entree", status: "Sweet Deal" },
            { label: "Family Platter", value: "$32", meta: "Serves 4", status: "Value Pack" },
          ],
        },
        {
          slug: "service-metrics",
          name: "Dining Snapshot",
          layout: "metric-cards",
          title: "Dining Room Snapshot",
          subtitle: "Useful for hostess desks and screens",
          badgeText: "Live Floor",
          rows: [
            { label: "Average Wait", value: "12m", meta: "Current", status: "Manageable" },
            { label: "Tables Ready", value: "8", meta: "Available now", status: "Seating" },
            { label: "Orders Served", value: "124", meta: "Today", status: "Running" },
          ],
        },
      ],
    },
    {
      category: "Hotel",
      accent: "#7d77f2",
      templates: [
        {
          slug: "arrival-board",
          name: "Arrival Board",
          layout: "schedule-board",
          title: "Today's Arrivals",
          subtitle: "Front desk check-in coordination",
          badgeText: "Reception",
          rows: [
            { label: "Patel Family", value: "11:00", meta: "Suite 402", status: "VIP" },
            { label: "Mr. Sharma", value: "12:30", meta: "Room 208", status: "Confirmed" },
            { label: "Global Travel Group", value: "14:15", meta: "4 rooms", status: "Prepare" },
          ],
        },
        {
          slug: "hotel-services",
          name: "Hotel Services",
          layout: "list-focus",
          title: "Guest Services",
          subtitle: "Highlight key amenities elegantly",
          badgeText: "Guest Comfort",
          rows: [
            { label: "Breakfast Buffet", value: "7 AM - 10 AM", meta: "Skyline Cafe", status: "Daily" },
            { label: "Spa Appointments", value: "Level 3", meta: "Advance booking", status: "Open" },
            { label: "Airport Shuttle", value: "Every 45 min", meta: "Lobby pickup", status: "Available" },
          ],
        },
        {
          slug: "occupancy-snapshot",
          name: "Occupancy Snapshot",
          layout: "metric-cards",
          title: "Hotel Performance",
          subtitle: "Useful for lobby or management displays",
          badgeText: "Daily Snapshot",
          rows: [
            { label: "Occupancy", value: "84%", meta: "Tonight", status: "Healthy" },
            { label: "Rooms Ready", value: "16", meta: "Clean now", status: "Available" },
            { label: "Late Checkouts", value: "7", meta: "Approved", status: "Managed" },
          ],
        },
      ],
    },
    {
      category: "Clinic",
      accent: "#2d9e91",
      templates: [
        {
          slug: "appointment-board",
          name: "Appointment Board",
          layout: "schedule-board",
          title: "Appointments Queue",
          subtitle: "Keep patients informed with clarity",
          badgeText: "Queue Live",
          rows: [
            { label: "Dr. Rao", value: "10:00", meta: "Consultation Room 2", status: "Next" },
            { label: "Dr. Singh", value: "10:15", meta: "Vaccination Desk", status: "Preparing" },
            { label: "Lab Collection", value: "10:30", meta: "Sample Room", status: "Open" },
          ],
        },
        {
          slug: "clinic-services",
          name: "Clinic Services",
          layout: "list-focus",
          title: "Available Services",
          subtitle: "Simple wayfinding and service promotion",
          badgeText: "Patient Care",
          rows: [
            { label: "General Consultation", value: "Walk-in", meta: "Morning slots", status: "Open" },
            { label: "Child Vaccination", value: "By Booking", meta: "Tue / Thu", status: "Scheduled" },
            { label: "Diagnostic Lab", value: "8 AM - 6 PM", meta: "Fast reports", status: "Running" },
          ],
        },
        {
          slug: "clinic-status",
          name: "Clinic Snapshot",
          layout: "metric-cards",
          title: "Clinic Snapshot",
          subtitle: "Helpful internal or lobby dashboard",
          badgeText: "Today",
          rows: [
            { label: "Patients Seen", value: "63", meta: "So far", status: "Active" },
            { label: "Avg Wait", value: "08m", meta: "Current", status: "Low" },
            { label: "Doctors Available", value: "4", meta: "Now", status: "On Duty" },
          ],
        },
      ],
    },
    {
      category: "Hospital",
      accent: "#1f8a70",
      templates: [
        {
          slug: "department-board",
          name: "Department Queue",
          layout: "schedule-board",
          title: "Department Queue Status",
          subtitle: "Keep visitors updated across service lines",
          badgeText: "Live Queue",
          rows: [
            { label: "Radiology", value: "10:10", meta: "Wing B", status: "Next Token 54" },
            { label: "Cardiology", value: "10:25", meta: "Wing A", status: "On Schedule" },
            { label: "Emergency Review", value: "Now", meta: "Bay 3", status: "Priority" },
          ],
        },
        {
          slug: "visitor-info",
          name: "Visitor Information",
          layout: "list-focus",
          title: "Visitor Information",
          subtitle: "Communicate rules and support services",
          badgeText: "Guidance",
          rows: [
            { label: "Visiting Hours", value: "4 PM - 7 PM", meta: "General wards", status: "Daily" },
            { label: "Billing Help", value: "Desk 6", meta: "Ground floor", status: "Open" },
            { label: "Pharmacy", value: "24 x 7", meta: "Main lobby", status: "Available" },
          ],
        },
        {
          slug: "hospital-ops",
          name: "Operations Snapshot",
          layout: "metric-cards",
          title: "Operations Snapshot",
          subtitle: "High-level hospital service summary",
          badgeText: "Ops Desk",
          rows: [
            { label: "Beds Available", value: "28", meta: "Across wards", status: "Updated" },
            { label: "Doctors On Duty", value: "19", meta: "All shifts", status: "Covered" },
            { label: "Emergency Wait", value: "14m", meta: "Current", status: "Stable" },
          ],
        },
      ],
    },
    {
      category: "Corporate Office",
      accent: "#4a76ff",
      templates: [
        {
          slug: "meeting-board",
          name: "Meeting Schedule",
          layout: "schedule-board",
          title: "Executive Floor Schedule",
          subtitle: "Meeting room and timing overview",
          badgeText: "Today's Agenda",
          rows: [
            { label: "Leadership Sync", value: "10:30", meta: "Board Room", status: "Confirmed" },
            { label: "Client Review", value: "12:00", meta: "Studio 2", status: "Prepared" },
            { label: "Town Hall", value: "15:00", meta: "Auditorium", status: "Open Seating" },
          ],
        },
        {
          slug: "office-highlights",
          name: "Office Highlights",
          layout: "list-focus",
          title: "Office Announcements",
          subtitle: "Sharp internal communication for teams",
          badgeText: "Internal Update",
          rows: [
            { label: "Cafeteria Special", value: "1 PM", meta: "South Wing", status: "Today" },
            { label: "Visitor Parking", value: "Zone C", meta: "New route", status: "Updated" },
            { label: "IT Help Desk", value: "Ext 245", meta: "Fast support", status: "Live" },
          ],
        },
        {
          slug: "office-dashboard",
          name: "Office Dashboard",
          layout: "metric-cards",
          title: "Workday Snapshot",
          subtitle: "Compact KPI view for common areas",
          badgeText: "HQ",
          rows: [
            { label: "Visitors Today", value: "24", meta: "Reception logged", status: "Active" },
            { label: "Meetings Booked", value: "18", meta: "Across rooms", status: "Scheduled" },
            { label: "Support Tickets", value: "6", meta: "Open now", status: "Low" },
          ],
        },
      ],
    },
    {
      category: "Gym",
      accent: "#ff6f61",
      templates: [
        {
          slug: "class-schedule",
          name: "Class Schedule",
          layout: "schedule-board",
          title: "Studio Class Schedule",
          subtitle: "Members can plan sessions instantly",
          badgeText: "Today's Classes",
          rows: [
            { label: "HIIT Blast", value: "07:00", meta: "Studio A", status: "Seats 12" },
            { label: "Yoga Flow", value: "09:30", meta: "Studio B", status: "Open" },
            { label: "Cycling Burn", value: "18:30", meta: "Spin Room", status: "Popular" },
          ],
        },
        {
          slug: "membership-offers",
          name: "Membership Offers",
          layout: "price-board",
          title: "Membership Offers",
          subtitle: "Promote plans and add-on packages",
          badgeText: "Join Today",
          rows: [
            { label: "Monthly Pass", price: "$39", meta: "Gym floor access", status: "Starter" },
            { label: "Quarterly Pack", price: "$99", meta: "Classes included", status: "Popular" },
            { label: "PT Session", price: "$18", meta: "Per session", status: "Add-on" },
          ],
        },
        {
          slug: "member-dashboard",
          name: "Member Dashboard",
          layout: "metric-cards",
          title: "Gym Floor Snapshot",
          subtitle: "Energetic but practical live overview",
          badgeText: "Live Floor",
          rows: [
            { label: "Active Members", value: "56", meta: "Checked in", status: "Busy" },
            { label: "Classes Today", value: "9", meta: "Across studios", status: "Running" },
            { label: "Trainer Slots", value: "4", meta: "Available", status: "Book Now" },
          ],
        },
      ],
    },
    {
      category: "Salon",
      accent: "#f06292",
      templates: [
        {
          slug: "booking-board",
          name: "Booking Board",
          layout: "schedule-board",
          title: "Today's Appointments",
          subtitle: "Smooth front-desk flow for stylists",
          badgeText: "Reception",
          rows: [
            { label: "Hair Styling", value: "11:00", meta: "Asha", status: "Confirmed" },
            { label: "Beard Grooming", value: "11:30", meta: "Nikhil", status: "Next" },
            { label: "Hair Color", value: "12:15", meta: "Meera", status: "Preparing" },
          ],
        },
        {
          slug: "salon-services",
          name: "Service Highlights",
          layout: "price-board",
          title: "Salon Service Menu",
          subtitle: "Showcase premium services cleanly",
          badgeText: "Top Picks",
          rows: [
            { label: "Hair Spa", price: "$22", meta: "Deep nourishment", status: "Popular" },
            { label: "Haircut + Wash", price: "$16", meta: "Classic styling", status: "Fast" },
            { label: "Keratin Touch-up", price: "$48", meta: "Smooth finish", status: "Premium" },
          ],
        },
        {
          slug: "salon-metrics",
          name: "Salon Snapshot",
          layout: "metric-cards",
          title: "Salon Snapshot",
          subtitle: "Useful for lobby or owner review",
          badgeText: "Today",
          rows: [
            { label: "Clients Served", value: "34", meta: "So far", status: "Steady" },
            { label: "Stylists On Duty", value: "5", meta: "Current", status: "Ready" },
            { label: "Walk-in Wait", value: "10m", meta: "Average", status: "Low" },
          ],
        },
      ],
    },
    {
      category: "Beauty Parlour",
      accent: "#d66fb1",
      templates: [
        {
          slug: "appointments",
          name: "Appointments Board",
          layout: "schedule-board",
          title: "Today's Beauty Sessions",
          subtitle: "Elegant appointment tracking",
          badgeText: "Front Desk",
          rows: [
            { label: "Bridal Trial", value: "10:30", meta: "Studio 1", status: "Priority" },
            { label: "Facial Therapy", value: "11:15", meta: "Room 2", status: "Next" },
            { label: "Nail Art", value: "12:00", meta: "Bar Station", status: "Confirmed" },
          ],
        },
        {
          slug: "beauty-menu",
          name: "Beauty Menu",
          layout: "price-board",
          title: "Beauty Service Menu",
          subtitle: "Promote high-value treatments",
          badgeText: "Premium Care",
          rows: [
            { label: "Glow Facial", price: "$28", meta: "60 min", status: "Bestseller" },
            { label: "Nail Art Set", price: "$18", meta: "Custom finish", status: "Trending" },
            { label: "Bridal Package", price: "$120", meta: "Consultation included", status: "Signature" },
          ],
        },
        {
          slug: "beauty-summary",
          name: "Beauty Summary",
          layout: "metric-cards",
          title: "Parlour Snapshot",
          subtitle: "Compact service and queue overview",
          badgeText: "Live",
          rows: [
            { label: "Sessions Today", value: "21", meta: "Booked", status: "Active" },
            { label: "Artists Available", value: "3", meta: "Current", status: "Open" },
            { label: "Average Wait", value: "07m", meta: "Walk-ins", status: "Low" },
          ],
        },
      ],
    },
    {
      category: "Clothing Store",
      accent: "#2f7fb4",
      templates: [
        {
          slug: "new-arrivals",
          name: "New Arrivals",
          layout: "list-focus",
          title: "New Arrivals Collection",
          subtitle: "Spotlight key lines in-store",
          badgeText: "Fresh Stock",
          rows: [
            { label: "Summer Linen Shirts", value: "Now In Store", meta: "Men's Section", status: "New" },
            { label: "Weekend Dresses", value: "Top Floor", meta: "Women's Line", status: "Trending" },
            { label: "Kids Casual Sets", value: "Zone K", meta: "Soft cotton", status: "Just Landed" },
          ],
        },
        {
          slug: "pricing-board",
          name: "Pricing Board",
          layout: "price-board",
          title: "Store Promotions",
          subtitle: "Clear offer board for conversion",
          badgeText: "Season Offer",
          rows: [
            { label: "Denim Collection", price: "25% Off", meta: "Selected styles", status: "Hot" },
            { label: "Formal Shirts", price: "2 for $45", meta: "Premium range", status: "Value" },
            { label: "Accessories", price: "$9+", meta: "Belts and wallets", status: "Add-on" },
          ],
        },
        {
          slug: "store-dashboard",
          name: "Store Dashboard",
          layout: "metric-cards",
          title: "Retail Snapshot",
          subtitle: "Smart summary for managers or customers",
          badgeText: "Store Floor",
          rows: [
            { label: "Walk-ins", value: "186", meta: "Today", status: "Active" },
            { label: "Trial Rooms", value: "4", meta: "Available", status: "Ready" },
            { label: "Top Category", value: "Denim", meta: "Best seller", status: "Leading" },
          ],
        },
      ],
    },
    {
      category: "Electronics Store",
      accent: "#00a1c9",
      templates: [
        {
          slug: "featured-tech",
          name: "Featured Tech",
          layout: "list-focus",
          title: "Featured Technology",
          subtitle: "Highlight hero products without heavy assets",
          badgeText: "Featured",
          rows: [
            { label: "4K Smart TV Series", value: "In Demo Zone", meta: "Cinema display", status: "New" },
            { label: "Noise-Cancel Headphones", value: "Audio Bar", meta: "Try live", status: "Popular" },
            { label: "Gaming Console Bundle", value: "Limited Units", meta: "Weekend offer", status: "Fast Moving" },
          ],
        },
        {
          slug: "offer-wall",
          name: "Offer Wall",
          layout: "price-board",
          title: "Tech Deals",
          subtitle: "Fast to update promo board for sales floors",
          badgeText: "Today's Deals",
          rows: [
            { label: "Bluetooth Speakers", price: "$29", meta: "Portable range", status: "Deal" },
            { label: "Laptop Upgrade", price: "$599", meta: "8GB / SSD", status: "Top Seller" },
            { label: "Phone Accessories", price: "Buy 2 Get 1", meta: "Cables and cases", status: "Bundle" },
          ],
        },
        {
          slug: "store-ops",
          name: "Store Ops",
          layout: "metric-cards",
          title: "Store Operations",
          subtitle: "Compact dashboard for high-traffic sections",
          badgeText: "Live Sales",
          rows: [
            { label: "Demos Running", value: "7", meta: "Across zones", status: "Active" },
            { label: "Support Staff", value: "9", meta: "On floor", status: "Available" },
            { label: "Fast Movers", value: "Audio", meta: "Category lead", status: "Hot" },
          ],
        },
      ],
    },
    {
      category: "School / College",
      accent: "#3f77d8",
      templates: [
        {
          slug: "class-schedule",
          name: "Class Schedule",
          layout: "schedule-board",
          title: "Campus Schedule",
          subtitle: "Daily academic timetable summary",
          badgeText: "Academic Desk",
          rows: [
            { label: "B.Sc. Physics", value: "09:00", meta: "Room 203", status: "Starting" },
            { label: "MBA Seminar", value: "10:30", meta: "Hall A", status: "Open" },
            { label: "Computer Lab", value: "12:00", meta: "Lab 4", status: "Practical" },
          ],
        },
        {
          slug: "campus-notices",
          name: "Campus Notices",
          layout: "list-focus",
          title: "Campus Notices",
          subtitle: "Broadcast reminders and updates clearly",
          badgeText: "Notice Board",
          rows: [
            { label: "Admission Help Desk", value: "Block C", meta: "9 AM - 4 PM", status: "Open" },
            { label: "Exam Forms", value: "Submit by Friday", meta: "Portal or office", status: "Important" },
            { label: "Sports Trials", value: "5 PM", meta: "Main ground", status: "This Week" },
          ],
        },
        {
          slug: "campus-dashboard",
          name: "Campus Dashboard",
          layout: "metric-cards",
          title: "Campus Snapshot",
          subtitle: "Useful for reception and admin blocks",
          badgeText: "Today",
          rows: [
            { label: "Classes Today", value: "42", meta: "Across departments", status: "Running" },
            { label: "Faculty On Site", value: "58", meta: "Active", status: "Present" },
            { label: "Events This Week", value: "5", meta: "Academic + cultural", status: "Upcoming" },
          ],
        },
      ],
    },
    {
      category: "Reception Area",
      accent: "#3683ff",
      templates: [
        {
          slug: "guest-schedule",
          name: "Guest Schedule",
          layout: "schedule-board",
          title: "Expected Guests",
          subtitle: "Professional reception planning board",
          badgeText: "Welcome Desk",
          rows: [
            { label: "Delta Consulting", value: "10:00", meta: "3 visitors", status: "Confirmed" },
            { label: "Vendor Meeting", value: "11:15", meta: "1 visitor", status: "Arriving" },
            { label: "Interview Panel", value: "13:30", meta: "2 candidates", status: "Scheduled" },
          ],
        },
        {
          slug: "wayfinding",
          name: "Wayfinding Board",
          layout: "list-focus",
          title: "Reception Guidance",
          subtitle: "Help guests navigate quickly",
          badgeText: "Wayfinding",
          rows: [
            { label: "Conference Hall", value: "Floor 2", meta: "Take left lift", status: "Direction" },
            { label: "HR Department", value: "Floor 4", meta: "Visitor pass required", status: "Access" },
            { label: "Cafe Lounge", value: "Ground Floor", meta: "Near atrium", status: "Open" },
          ],
        },
        {
          slug: "desk-summary",
          name: "Desk Summary",
          layout: "metric-cards",
          title: "Reception Snapshot",
          subtitle: "A calm high-level dashboard",
          badgeText: "Front Desk",
          rows: [
            { label: "Visitors Today", value: "31", meta: "Registered", status: "Tracked" },
            { label: "Passes Issued", value: "18", meta: "Current", status: "Live" },
            { label: "Meeting Rooms Busy", value: "5", meta: "Now", status: "In Use" },
          ],
        },
        {
          slug: "welcoming-guest",
          name: "Welcoming Guest",
          layout: "welcome-guest",
          title: "Welcoming Our Esteemed Guest",
          subtitle: "Create a premium lobby poster with full guest image, host details, and reception messaging.",
          badgeText: "Guest Of Honour",
          rows: [
            { label: "Guest Name", value: "Dr. A. K. Sharma", meta: "Chief Keynote Speaker", status: "Today" },
            { label: "Hosted By", value: "NVA Group", meta: "Corporate Leadership Summit", status: "Main Event" },
            { label: "Venue", value: "Grand Reception Hall", meta: "10:30 AM Onwards", status: "Welcome" },
          ],
        },
      ],
    },
    {
      category: "Real Estate",
      accent: "#3d95c6",
      templates: [
        {
          slug: "site-visits",
          name: "Site Visits",
          layout: "schedule-board",
          title: "Today's Site Visits",
          subtitle: "Sales team planning and walk-in tracking",
          badgeText: "Sales Desk",
          rows: [
            { label: "Maple Residency", value: "10:30", meta: "2 BHK Tour", status: "Booked" },
            { label: "Riverfront Towers", value: "12:00", meta: "Investor Visit", status: "VIP" },
            { label: "Skyline Villas", value: "15:15", meta: "Family Viewing", status: "Confirmed" },
          ],
        },
        {
          slug: "featured-properties",
          name: "Featured Properties",
          layout: "price-board",
          title: "Featured Properties",
          subtitle: "Promote inventory with clean pricing",
          badgeText: "Available Now",
          rows: [
            { label: "2 BHK Apartments", price: "$145k", meta: "Near city center", status: "Move-in Ready" },
            { label: "Premium Villas", price: "$320k", meta: "Gated community", status: "Limited" },
            { label: "Retail Spaces", price: "$210k", meta: "High footfall area", status: "Investor Pick" },
          ],
        },
        {
          slug: "sales-overview",
          name: "Sales Overview",
          layout: "metric-cards",
          title: "Sales Snapshot",
          subtitle: "Compact view for office or showroom",
          badgeText: "This Month",
          rows: [
            { label: "Leads Generated", value: "128", meta: "Qualified", status: "Growing" },
            { label: "Visits Today", value: "11", meta: "Scheduled", status: "Active" },
            { label: "Units Reserved", value: "6", meta: "Current cycle", status: "Strong" },
          ],
        },
      ],
    },
    {
      category: "Supermarket",
      accent: "#2aa267",
      templates: [
        {
          slug: "hourly-offers",
          name: "Hourly Offers",
          layout: "price-board",
          title: "Fresh Offers",
          subtitle: "Fast-changing supermarket promo board",
          badgeText: "Value Picks",
          rows: [
            { label: "Fresh Apples", price: "$2.49/kg", meta: "Farm arrival", status: "Fresh" },
            { label: "Family Bread", price: "$1.99", meta: "Bakery counter", status: "Daily Essential" },
            { label: "Laundry Pack", price: "15% Off", meta: "Aisle 8", status: "Savings" },
          ],
        },
        {
          slug: "store-services",
          name: "Store Services",
          layout: "list-focus",
          title: "Store Services",
          subtitle: "Guide shoppers with useful service info",
          badgeText: "Customer Help",
          rows: [
            { label: "Billing Counters", value: "1 - 10", meta: "Express lanes open", status: "Fast" },
            { label: "Home Delivery", value: "Desk 2", meta: "Orders above $25", status: "Available" },
            { label: "Fresh Produce", value: "Aisle 1", meta: "Restocked hourly", status: "In Stock" },
          ],
        },
        {
          slug: "store-summary",
          name: "Store Summary",
          layout: "metric-cards",
          title: "Store Snapshot",
          subtitle: "Quick numbers for store operations",
          badgeText: "Live Store",
          rows: [
            { label: "Counters Open", value: "8", meta: "Right now", status: "Serving" },
            { label: "Offers Running", value: "23", meta: "Across aisles", status: "Active" },
            { label: "Peak Hour", value: "6 PM", meta: "Expected today", status: "Prepare" },
          ],
        },
      ],
    },
    {
      category: "Temple",
      accent: "#d39a2b",
      templates: [
        {
          slug: "donation-board",
          name: "Donation Board",
          layout: "schedule-board",
          title: "Today's Donation Updates",
          subtitle: "Track seva, donation, and sponsor announcements",
          badgeText: "Seva Desk",
          rows: [
            { label: "Annadanam Sponsor", value: "10:30", meta: "Dining Hall", status: "Confirmed" },
            { label: "Temple Renovation", value: "$2,450", meta: "Community collection", status: "Updated" },
            { label: "Special Puja Seva", value: "06:00 PM", meta: "Main sanctum", status: "Open" },
          ],
        },
        {
          slug: "seva-services",
          name: "Seva Services",
          layout: "list-focus",
          title: "Temple Seva Services",
          subtitle: "Guide devotees to the right counter and offering desk",
          badgeText: "Devotee Info",
          rows: [
            { label: "Donation Counter", value: "Hall A", meta: "Cash and digital accepted", status: "Open" },
            { label: "Archana Booking", value: "Desk 3", meta: "Morning and evening slots", status: "Available" },
            { label: "Prasadam Collection", value: "Exit Gate", meta: "After aarti timings", status: "Active" },
          ],
        },
        {
          slug: "temple-snapshot",
          name: "Temple Snapshot",
          layout: "metric-cards",
          title: "Temple Daily Snapshot",
          subtitle: "Useful for donation desk and administration screens",
          badgeText: "Daily View",
          rows: [
            { label: "Today's Donations", value: "$5,820", meta: "Till now", status: "Growing" },
            { label: "Sevas Booked", value: "47", meta: "Today", status: "Confirmed" },
            { label: "Devotees Served", value: "1,280", meta: "Entry count", status: "Active" },
          ],
        },
      ],
    },
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function withAlpha(hex, alpha) {
    const raw = String(hex || "#2563eb").replace("#", "").trim();
    const full = raw.length === 3
      ? raw.split("").map((part) => part + part).join("")
      : raw.padEnd(6, "0").slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeRowAnchor(value) {
    const anchor = String(value || "top").trim().toLowerCase();
    return TEMPLATE_ROW_ANCHORS.includes(anchor) ? anchor : "top";
  }

  function resolveRowJustify(anchor) {
    if (anchor === "bottom") return "flex-end";
    if (anchor === "middle") return "center";
    return "flex-start";
  }

  function resolveRowAlign(anchor) {
    if (anchor === "bottom") return "end";
    if (anchor === "middle") return "center";
    return "start";
  }

  function resolveColor(value, fallback) {
    const raw = String(value || "").trim();
    return raw || fallback;
  }

  function getPreviewMetrics(instance, options) {
    const width = Math.max(120, Number(options?.width || (options?.compact ? 280 : 480)));
    const height = Math.max(120, Number(options?.height || (options?.compact ? 180 : 320)));
    const rowCount = Math.max(1, Math.min(5, Number(options?.rowCount || instance?.rows?.length || 1)));
    const compact = !!options?.compact || width < 320 || height < 210;
    const spacious = width >= 460 && height >= 280;
    const crowded = rowCount >= 4;
    const veryCrowded = rowCount >= 5;
    const scaleBase = Number(instance?.fontScale || 1);
    const titleBoost = Number(instance?.titleScale || 1);
    const subtitleBoost = Number(instance?.subtitleScale || 1);
    const badgeBoost = Number(instance?.badgeScale || 1);
    const logoBoost = Number(instance?.logoScale || 1);
    const rowImageBoost = Number(instance?.rowImageScale || 1);
    const rowTextBoost = Number(instance?.rowTextScale || 1);
    const rowMetaBoost = Number(instance?.rowMetaScale || 1);
    const rowValueBoost = Number(instance?.rowValueScale || 1);
    const rowPaddingBoost = Number(instance?.rowPaddingScale || 1);
    const rowRadiusBoost = Number(instance?.rowRadiusScale || 1);
    const headerSpacingBoost = Number(instance?.headerSpacingScale || 1);
    const bodyTopBoost = Number(instance?.bodyTopScale || 1);
    const canvasPaddingBoost = Number(instance?.canvasPaddingScale || 1);
    const rowAnchor = normalizeRowAnchor(instance?.rowAnchor);
    const gapBoost = Number(instance?.rowGapScale || 1);
    const bodyGap = Math.round((compact ? (crowded ? 8 : 9) : crowded ? 10 : 12) * gapBoost);
    const rowBoxBoost = Number(instance?.rowBoxScale || 1);
    const rowPadV = Math.round((compact ? 7 : 9) * Math.min(2.8, 0.92 + rowBoxBoost * 0.34 + rowMetaBoost * 0.08) * rowPaddingBoost);
    const rowPadH = Math.round((compact ? 10 : 12) * rowPaddingBoost);
    const rowRadius = Math.round((compact ? 14 : 16) * rowRadiusBoost);
    const metricRadius = Math.round((compact ? 16 : 18) * rowRadiusBoost);
    const guestCardRadius = Math.round((compact ? 16 : 18) * rowRadiusBoost);
    const guestHeroRadius = Math.round((compact ? 18 : 22) * rowRadiusBoost);
    const shellPad = Math.round((compact ? 10 : 14) * canvasPaddingBoost);
    const logoSize = clamp((compact ? (crowded ? 38 : 44) : spacious ? (crowded ? 60 : 74) : 54) * logoBoost, 26, 120);
    const rowImageSize = clamp((compact ? (crowded ? 42 : 48) : spacious ? (crowded ? 64 : 82) : 56) * rowImageBoost, 28, 132);
    const sideWidth = clamp(
      (compact ? 62 : crowded ? 72 : 86) * Math.max(1, rowValueBoost * 0.18 + rowMetaBoost * 0.12),
      compact ? 62 : 72,
      compact ? 148 : 220
    );
    const titleSize = clamp((compact ? 16 : spacious ? 26 : 20) * scaleBase * titleBoost, 12, 52);
    const subtitleSize = clamp((compact ? 9 : spacious ? 13 : 11) * scaleBase * subtitleBoost, 8, 24);
    const badgeSize = clamp((compact ? 8 : 10) * scaleBase * badgeBoost, 7, 22);
    const headerGap = Math.round((compact ? 8 : 10) * headerSpacingBoost);
    const headerBottom = Math.round((compact ? 8 : 12) * headerSpacingBoost);
    const bodyTop = Math.round((compact ? 6 : 10) * bodyTopBoost);
    const metricCols = width < 280 || height > width * 1.15 ? 1 : 2;
    const metricRowsPerColumn = Math.max(1, Math.ceil(rowCount / metricCols));
    const bodyHeight = Math.max(120, height - logoSize - titleSize * 2.2 - subtitleSize * 1.6 - headerBottom - bodyTop);
    const rowHeight = clamp(
      ((bodyHeight - bodyGap * Math.max(0, rowCount - 1)) / rowCount) * rowBoxBoost,
      compact ? 52 : 64,
      compact ? 168 : 240
    );
    const metricHeight = clamp(
      ((bodyHeight - bodyGap * Math.max(0, metricRowsPerColumn - 1)) / metricRowsPerColumn) * rowBoxBoost,
      compact ? 64 : 78,
      compact ? 196 : 280
    );
    const rowTitleSize = clamp((compact ? 10.5 : 15) * scaleBase * rowTextBoost, 8, 46);
    const rowMetaSize = clamp((compact ? 7.4 : 10.5) * scaleBase * rowMetaBoost, 6, 34);
    const rowValueSize = clamp((compact ? 11.5 : 18.5) * scaleBase * rowValueBoost, 9, 52);

    return {
      width,
      height,
      compact,
      rowLimit: compact ? Math.min(3, rowCount) : Math.min(5, rowCount),
      vars: [
        `--tpl-title-size:${titleSize}px`,
        `--tpl-subtitle-size:${subtitleSize}px`,
        `--tpl-badge-size:${badgeSize}px`,
        `--tpl-logo-size:${logoSize}px`,
        `--tpl-header-gap:${headerGap}px`,
        `--tpl-header-bottom:${headerBottom}px`,
        `--tpl-body-top:${bodyTop}px`,
        `--tpl-body-gap:${bodyGap}px`,
        `--tpl-row-pad-v:${rowPadV}px`,
        `--tpl-row-pad-h:${rowPadH}px`,
        `--tpl-row-radius:${rowRadius}px`,
        `--tpl-metric-radius:${metricRadius}px`,
        `--tpl-guest-card-radius:${guestCardRadius}px`,
        `--tpl-guest-hero-radius:${guestHeroRadius}px`,
        `--tpl-shell-pad:${shellPad}px`,
        `--tpl-row-height:${rowHeight}px`,
        `--tpl-side-width:${sideWidth}px`,
        `--tpl-row-image-size:${rowImageSize}px`,
        `--tpl-metric-cols:${metricCols}`,
        `--tpl-metric-height:${metricHeight}px`,
        `--tpl-row-title-size:${rowTitleSize}px`,
        `--tpl-row-meta-size:${rowMetaSize}px`,
        `--tpl-row-value-size:${rowValueSize}px`,
        `--tpl-row-title-line:${Math.round(rowTitleSize * 1.16)}px`,
        `--tpl-row-meta-line:${Math.round(rowMetaSize * 1.28)}px`,
        `--tpl-row-value-line:${Math.round(rowValueSize * 1.08)}px`,
        `--tpl-bg-size:${clamp(Number(instance?.backgroundZoom || 1) * 100, 80, 180)}%`,
        `--tpl-body-justify:${resolveRowJustify(rowAnchor)}`,
        `--tpl-body-align:${resolveRowAlign(rowAnchor)}`,
      ],
    };
  }

  function makeTemplateId(category, slug) {
    return `${String(category || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}-${slug}`;
  }

  function readLibraryOverrides() {
    try {
      const raw = window.localStorage?.getItem(TEMPLATE_LIBRARY_OVERRIDES_KEY) || "";
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLibraryOverrides(overrides) {
    try {
      window.localStorage?.setItem(
        TEMPLATE_LIBRARY_OVERRIDES_KEY,
        JSON.stringify(overrides && typeof overrides === "object" ? overrides : {})
      );
    } catch (_error) {
    }
  }

  function resolveTemplateWebFont(value) {
    const key = String(value || "system").trim().toLowerCase();
    const match = TEMPLATE_FONT_OPTIONS.find((item) => item.value === key);
    return match?.webFamily || TEMPLATE_FONT_OPTIONS[0].webFamily;
  }

  const TEMPLATE_LIBRARY = CATEGORY_DEFINITIONS.flatMap((group) =>
    group.templates.map((entry, index) => {
      const id = makeTemplateId(group.category, entry.slug);
      return {
        id,
        category: group.category,
        name: entry.name,
        description: entry.subtitle,
        layout: entry.layout,
        order: index,
        defaults: {
          category: group.category,
          titleText: entry.title,
          subtitleText: entry.subtitle,
          badgeText: entry.badgeText,
          primaryColor: group.accent,
          secondaryColor: "#f4f7fb",
          backgroundColor: "#08121b",
          fontFamily: "system",
          fontScale: 1,
          titleScale: 1,
          subtitleScale: 1,
          badgeScale: 1,
          logoScale: 1,
          titleColor: "",
          titleBgColor: "",
          subtitleColor: "",
          subtitleBgColor: "",
          badgeColor: "",
          badgeBgColor: "",
          rowTitleColor: "",
          rowMetaColor: "",
          rowValueColor: "",
          rowStatusColor: "",
          rowBoxBgColor: "",
          rowBoxBorderColor: "",
          showHeader: entry.layout === "welcome-guest" ? false : true,
          showTitle: true,
          showSubtitle: true,
          showLogo: true,
          showBadge: true,
          showRows: true,
          showRowImages: true,
          showFeatureImage: true,
          showBackgroundImage: true,
          rowTextScale: 1,
          rowMetaScale: 1,
          rowValueScale: 1,
          rowImageScale: 1,
          rowGapScale: 1,
          rowBoxScale: 1,
          rowAnchor: "top",
          rowPaddingScale: 1,
          rowRadiusScale: 1,
          headerSpacingScale: 1,
          bodyTopScale: 1,
          canvasPaddingScale: 1,
          backgroundZoom: 1,
          logoUrl: "",
          imageUrl: "",
          rows: entry.rows.map((row) => ({
            label: row.label || "",
            value: row.value || "",
            meta: row.meta || "",
            status: row.status || "",
            price: row.price || "",
            imageUrl: row.imageUrl || "",
            hidden: row.hidden === true,
          })),
        },
      };
    })
  );
  const libraryOverrides = readLibraryOverrides();
  const libraryMap = Object.fromEntries(TEMPLATE_LIBRARY.map((item) => [item.id, item]));
  TEMPLATE_LIBRARY.forEach((item) => {
    const overrides = libraryOverrides[item.id];
    if (!overrides || typeof overrides !== "object") return;
    const mergedDefaults = buildTemplateInstance(item.id, overrides);
    if (!mergedDefaults) return;
    item.defaults = {
      ...clone(item.defaults),
      ...clone(mergedDefaults),
      rows: clone(mergedDefaults.rows || item.defaults.rows || []),
    };
  });
  const sectionState = { 1: [], 2: [], 3: [] };
  let changeListener = null;
  let pickerSection = 1;
  let pickerSearch = "";
  let pickerCategory = "all";
  let editingTarget = null;
  let pickerGridScrollTop = 0;
  let pickerPanelScrollTop = 0;

  function normalizeRow(row) {
    return {
      label: String(row?.label || ""),
      value: String(row?.value || ""),
      meta: String(row?.meta || ""),
      status: String(row?.status || ""),
      price: String(row?.price || ""),
      imageUrl: String(row?.imageUrl || ""),
      hidden: row?.hidden === true,
    };
  }

  function buildTemplateInstance(templateId, overrides) {
    const base = libraryMap[templateId];
    if (!base) return null;
    const merged = {
      ...clone(base.defaults),
      ...(overrides && typeof overrides === "object" ? overrides : {}),
    };
    const rows = Array.isArray(overrides?.rows) ? overrides.rows : merged.rows;
    return {
      templateId: base.id,
      category: String(merged.category || base.category || ""),
      name: base.name,
      layout: base.layout,
      titleText: String(merged.titleText || base.defaults.titleText || ""),
      subtitleText: String(merged.subtitleText || base.defaults.subtitleText || ""),
      badgeText: String(merged.badgeText || ""),
      titleColor: String(merged.titleColor || ""),
      titleBgColor: String(merged.titleBgColor || ""),
      subtitleColor: String(merged.subtitleColor || ""),
      subtitleBgColor: String(merged.subtitleBgColor || ""),
      badgeColor: String(merged.badgeColor || ""),
      badgeBgColor: String(merged.badgeBgColor || ""),
      rowTitleColor: String(merged.rowTitleColor || ""),
      rowMetaColor: String(merged.rowMetaColor || ""),
      rowValueColor: String(merged.rowValueColor || ""),
      rowStatusColor: String(merged.rowStatusColor || ""),
      rowBoxBgColor: String(merged.rowBoxBgColor || ""),
      rowBoxBorderColor: String(merged.rowBoxBorderColor || ""),
      showHeader: merged.showHeader !== false,
      showTitle: merged.showTitle !== false,
      showSubtitle: merged.showSubtitle !== false,
      primaryColor: String(merged.primaryColor || base.defaults.primaryColor || "#2563eb"),
      secondaryColor: String(merged.secondaryColor || "#f4f7fb"),
      backgroundColor: String(merged.backgroundColor || "#08121b"),
      backgroundImageUrl: String(merged.backgroundImageUrl || ""),
      fontFamily: String(merged.fontFamily || "system"),
      fontScale: Math.max(0.7, Math.min(2, Number(merged.fontScale || 1))),
      titleScale: Math.max(0.7, Math.min(2.4, Number(merged.titleScale || 1))),
      subtitleScale: Math.max(0.7, Math.min(2.4, Number(merged.subtitleScale || 1))),
      badgeScale: Math.max(0.7, Math.min(2.4, Number(merged.badgeScale || 1))),
      logoScale: Math.max(0.7, Math.min(2.4, Number(merged.logoScale || 1))),
      showLogo: merged.showLogo !== false,
      showBadge: merged.showBadge !== false,
      showRows: merged.showRows !== false,
      showRowImages: merged.showRowImages !== false,
      showFeatureImage: merged.showFeatureImage !== false,
      showBackgroundImage: merged.showBackgroundImage !== false,
      rowTextScale: Math.max(0.7, Math.min(2.6, Number(merged.rowTextScale || 1))),
      rowMetaScale: Math.max(0.7, Math.min(2.6, Number(merged.rowMetaScale || 1))),
      rowValueScale: Math.max(0.7, Math.min(2.8, Number(merged.rowValueScale || 1))),
      rowImageScale: Math.max(0.7, Math.min(2.4, Number(merged.rowImageScale || 1))),
      rowGapScale: Math.max(0.7, Math.min(TEMPLATE_ROW_GAP_MAX, Number(merged.rowGapScale || 1))),
      rowBoxScale: Math.max(0.7, Math.min(TEMPLATE_ROW_BOX_MAX, Number(merged.rowBoxScale || 1))),
      rowAnchor: normalizeRowAnchor(merged.rowAnchor),
      rowPaddingScale: Math.max(0.7, Math.min(2.6, Number(merged.rowPaddingScale || 1))),
      rowRadiusScale: Math.max(0.7, Math.min(2.8, Number(merged.rowRadiusScale || 1))),
      headerSpacingScale: Math.max(0.6, Math.min(2.5, Number(merged.headerSpacingScale || 1))),
      bodyTopScale: Math.max(0.5, Math.min(3, Number(merged.bodyTopScale || 1))),
      canvasPaddingScale: Math.max(0.7, Math.min(2.4, Number(merged.canvasPaddingScale || 1))),
      backgroundZoom: Math.max(0.8, Math.min(1.8, Number(merged.backgroundZoom || 1))),
      logoUrl: String(merged.logoUrl || ""),
      imageUrl: String(merged.imageUrl || ""),
      rows: (Array.isArray(rows) ? rows : base.defaults.rows).slice(0, 5).map(normalizeRow),
    };
  }

  function listCategories() {
    return [...new Set(TEMPLATE_LIBRARY.map((item) => item.category))];
  }

  function getSectionTemplates(section) {
    const safeSection = Number(section || 1);
    return Array.isArray(sectionState[safeSection]) ? sectionState[safeSection] : [];
  }

  function setSectionTemplates(section, templates, options) {
    const safeSection = Number(section || 1);
    sectionState[safeSection] = Array.isArray(templates) ? templates : [];
    renderSectionSummary(safeSection);
    if (!options?.silent && typeof changeListener === "function") {
      changeListener(safeSection, clone(sectionState[safeSection]));
    }
  }

  function getSectionConfig(section) {
    const playlist = getSectionTemplates(section).map((item) => clone(item));
    return {
      templatePlaylist: playlist,
      templateConfig: playlist[0] ? clone(playlist[0]) : null,
    };
  }

  function hydrateSection(section, sectionConfig, options) {
    const playlist = Array.isArray(sectionConfig?.templatePlaylist) && sectionConfig.templatePlaylist.length
      ? sectionConfig.templatePlaylist
      : sectionConfig?.templateConfig
      ? [sectionConfig.templateConfig]
      : [];
    const hydrated = playlist
      .map((item) => buildTemplateInstance(item?.templateId || item?.id || "", item))
      .filter(Boolean);
    setSectionTemplates(section, hydrated, options);
  }

  function triggerSectionPreviewRefresh() {
    if (typeof window.renderScreenPreview === "function") {
      window.renderScreenPreview();
    }
  }

  function ensureRows(instance) {
    const next = clone(instance);
    next.rows = Array.isArray(next.rows) && next.rows.length
      ? next.rows.slice(0, 5).map(normalizeRow)
      : [
          { label: "Item 1", value: "", meta: "", status: "", price: "", imageUrl: "" },
          { label: "Item 2", value: "", meta: "", status: "", price: "", imageUrl: "" },
          { label: "Item 3", value: "", meta: "", status: "", price: "", imageUrl: "" },
        ];
    return next;
  }

  function renderSectionSummary(section) {
    const container = document.getElementById(`templateSummary${section}`);
    if (!container) return;
    const templates = getSectionTemplates(section);
    if (!templates.length) {
      container.innerHTML = `
        <div class="template-empty-state">
          <div class="template-empty-title">No template selected</div>
          <div class="template-empty-copy">Choose one or more lightweight templates for this section.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = templates
      .map((item, index) => `
        <div class="template-pill">
          <div class="template-pill-index" aria-hidden="true">
            ${index + 1}
          </div>
          <div class="template-pill-actions">
            <button class="btn primary template-icon-btn" type="button" title="Edit template" aria-label="Edit template" onclick="window.TemplateSystem.openEditor(${section}, ${index})">E</button>
            <button class="btn warning template-icon-btn" type="button" title="Remove template" aria-label="Remove template" onclick="window.TemplateSystem.removeTemplate(${section}, ${index})">X</button>
          </div>
        </div>
      `)
      .join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getFilteredLibrary() {
    return TEMPLATE_LIBRARY.filter((item) => {
      const matchesCategory = pickerCategory === "all" || item.category === pickerCategory;
      if (!matchesCategory) return false;
      if (!pickerSearch.trim()) return true;
      const haystack = `${item.name} ${item.category} ${item.description}`.toLowerCase();
      return haystack.includes(pickerSearch.trim().toLowerCase());
    });
  }

  function ensureModal() {
    let overlay = document.getElementById("templateSystemOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "templateSystemOverlay";
    overlay.className = "template-modal-overlay hidden";
    overlay.innerHTML = `<div id="templateSystemPanel" class="template-modal-panel"></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });
    return overlay;
  }

  function openPicker(section) {
    pickerSection = Number(section || 1);
    pickerSearch = "";
    pickerCategory = "all";
    editingTarget = null;
    renderPicker();
  }

  function renderPicker() {
    const overlay = ensureModal();
    const panel = document.getElementById("templateSystemPanel");
    const selectedIds = new Set(getSectionTemplates(pickerSection).map((item) => item.templateId));
    const cards = getFilteredLibrary()
      .map((item) => {
        const selected = selectedIds.has(item.id);
        const preview = buildTemplatePreviewMarkup(buildTemplateInstance(item.id), { compact: true });
        return `
          <div class="template-card ${selected ? "is-selected" : ""}">
            <div class="template-card-preview">${preview}</div>
            <div class="template-card-copy">
              <div class="template-card-category">${escapeHtml(item.category)}</div>
              <h4>${escapeHtml(item.name)}</h4>
              <p>${escapeHtml(item.description)}</p>
            </div>
            <div class="template-card-actions">
              <button class="btn ${selected ? "warning" : "primary"}" type="button" onclick="window.TemplateSystem.toggleSelection('${item.id}')">
                ${selected ? "Remove" : "Select"}
              </button>
              <button class="btn primary" type="button" onclick="window.TemplateSystem.pickAndEdit('${item.id}')">Edit</button>
            </div>
          </div>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="template-modal-head">
        <div>
          <div class="template-modal-kicker">Template Library</div>
          <h3>Section ${pickerSection} Templates</h3>
          <p>Choose one or more lightweight templates. They stay local in config and work offline after sync.</p>
        </div>
        <button class="btn warning" type="button" onclick="window.TemplateSystem.closeModal()">Close</button>
      </div>
      <div class="template-toolbar">
        <input
          id="templateSearchInput"
          type="text"
          placeholder="Search category or template"
          value="${escapeHtml(pickerSearch)}"
        />
        <select id="templateCategoryFilter">
          <option value="all">All Categories</option>
          ${listCategories().map((category) => `
            <option value="${escapeHtml(category)}" ${pickerCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>
          `).join("")}
        </select>
      </div>
      <div class="template-selection-summary">
        <span>${getSectionTemplates(pickerSection).length} template(s) selected for this section</span>
        <button class="btn primary" type="button" onclick="window.TemplateSystem.closeModal()">Done</button>
      </div>
      <div class="template-grid">${cards || '<div class="template-grid-empty">No templates match your search.</div>'}</div>
    `;

    overlay.classList.remove("hidden");
    panel.scrollTop = pickerPanelScrollTop;
    const grid = panel.querySelector(".template-grid");
    if (grid) grid.scrollTop = pickerGridScrollTop;
    const searchInput = document.getElementById("templateSearchInput");
    const categoryFilter = document.getElementById("templateCategoryFilter");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        pickerSearch = String(event?.target?.value || "");
        renderPicker();
      });
    }
    if (categoryFilter) {
      categoryFilter.addEventListener("change", (event) => {
        pickerCategory = String(event?.target?.value || "all");
        renderPicker();
      });
    }
  }

  function closeModal() {
    const overlay = ensureModal();
    overlay.classList.add("hidden");
    triggerSectionPreviewRefresh();
  }

  function toggleSelection(templateId) {
    const panel = document.getElementById("templateSystemPanel");
    const grid = panel?.querySelector(".template-grid");
    pickerPanelScrollTop = Number(panel?.scrollTop || 0);
    pickerGridScrollTop = Number(grid?.scrollTop || 0);
    const current = getSectionTemplates(pickerSection);
    const existingIndex = current.findIndex((item) => item.templateId === templateId);
    let next = current.slice();
    if (existingIndex >= 0) {
      next.splice(existingIndex, 1);
    } else {
      const instance = buildTemplateInstance(templateId);
      if (instance) next.push(instance);
    }
    setSectionTemplates(pickerSection, next);
    renderPicker();
  }

  function pickAndEdit(templateId) {
    const current = getSectionTemplates(pickerSection);
    const existingIndex = current.findIndex((item) => item.templateId === templateId);
    if (existingIndex >= 0) {
      openEditor(pickerSection, existingIndex);
      return;
    }
    const instance = buildTemplateInstance(templateId);
    if (!instance) return;
    const next = current.concat(instance);
    setSectionTemplates(pickerSection, next);
    openEditor(pickerSection, next.length - 1);
  }

  function removeTemplate(section, index) {
    const current = getSectionTemplates(section).slice();
    current.splice(index, 1);
    setSectionTemplates(section, current);
    triggerSectionPreviewRefresh();
  }

  function persistTemplateAsDefault(instance) {
    const templateId = String(instance?.templateId || "").trim();
    const base = libraryMap[templateId];
    if (!templateId || !base) return;

    const nextDefaults = {
      category: String(instance?.category || base.category || ""),
      titleText: String(instance?.titleText || base.defaults.titleText || ""),
      subtitleText: String(instance?.subtitleText || base.defaults.subtitleText || ""),
      badgeText: String(instance?.badgeText || ""),
      titleColor: String(instance?.titleColor || ""),
      titleBgColor: String(instance?.titleBgColor || ""),
      subtitleColor: String(instance?.subtitleColor || ""),
      subtitleBgColor: String(instance?.subtitleBgColor || ""),
      badgeColor: String(instance?.badgeColor || ""),
      badgeBgColor: String(instance?.badgeBgColor || ""),
      rowTitleColor: String(instance?.rowTitleColor || ""),
      rowMetaColor: String(instance?.rowMetaColor || ""),
      rowValueColor: String(instance?.rowValueColor || ""),
      rowStatusColor: String(instance?.rowStatusColor || ""),
      rowBoxBgColor: String(instance?.rowBoxBgColor || ""),
      rowBoxBorderColor: String(instance?.rowBoxBorderColor || ""),
      showHeader: instance?.showHeader !== false,
      showTitle: instance?.showTitle !== false,
      showSubtitle: instance?.showSubtitle !== false,
      showLogo: instance?.showLogo !== false,
      showBadge: instance?.showBadge !== false,
      showRows: instance?.showRows !== false,
      showRowImages: instance?.showRowImages !== false,
      showFeatureImage: instance?.showFeatureImage !== false,
      showBackgroundImage: instance?.showBackgroundImage !== false,
      primaryColor: String(instance?.primaryColor || base.defaults.primaryColor || "#2563eb"),
      secondaryColor: String(instance?.secondaryColor || base.defaults.secondaryColor || "#f4f7fb"),
      backgroundColor: String(instance?.backgroundColor || base.defaults.backgroundColor || "#08121b"),
      backgroundImageUrl: String(instance?.backgroundImageUrl || ""),
      fontFamily: String(instance?.fontFamily || base.defaults.fontFamily || "system"),
      fontScale: Math.max(0.7, Math.min(2, Number(instance?.fontScale || 1))),
      titleScale: Math.max(0.7, Math.min(2.4, Number(instance?.titleScale || 1))),
      subtitleScale: Math.max(0.7, Math.min(2.4, Number(instance?.subtitleScale || 1))),
      badgeScale: Math.max(0.7, Math.min(2.4, Number(instance?.badgeScale || 1))),
      logoScale: Math.max(0.7, Math.min(2.4, Number(instance?.logoScale || 1))),
      showLogo: instance?.showLogo !== false,
      showBadge: instance?.showBadge !== false,
      showRows: instance?.showRows !== false,
      showRowImages: instance?.showRowImages !== false,
      showFeatureImage: instance?.showFeatureImage !== false,
      showBackgroundImage: instance?.showBackgroundImage !== false,
      rowTextScale: Math.max(0.7, Math.min(2.6, Number(instance?.rowTextScale || 1))),
      rowMetaScale: Math.max(0.7, Math.min(2.6, Number(instance?.rowMetaScale || 1))),
      rowValueScale: Math.max(0.7, Math.min(2.8, Number(instance?.rowValueScale || 1))),
      rowImageScale: Math.max(0.7, Math.min(2.4, Number(instance?.rowImageScale || 1))),
      rowGapScale: Math.max(0.7, Math.min(TEMPLATE_ROW_GAP_MAX, Number(instance?.rowGapScale || 1))),
      rowBoxScale: Math.max(0.7, Math.min(TEMPLATE_ROW_BOX_MAX, Number(instance?.rowBoxScale || 1))),
      rowAnchor: normalizeRowAnchor(instance?.rowAnchor),
      rowPaddingScale: Math.max(0.7, Math.min(2.6, Number(instance?.rowPaddingScale || 1))),
      rowRadiusScale: Math.max(0.7, Math.min(2.8, Number(instance?.rowRadiusScale || 1))),
      headerSpacingScale: Math.max(0.6, Math.min(2.5, Number(instance?.headerSpacingScale || 1))),
      bodyTopScale: Math.max(0.5, Math.min(3, Number(instance?.bodyTopScale || 1))),
      canvasPaddingScale: Math.max(0.7, Math.min(2.4, Number(instance?.canvasPaddingScale || 1))),
      backgroundZoom: Math.max(0.8, Math.min(1.8, Number(instance?.backgroundZoom || 1))),
      logoUrl: String(instance?.logoUrl || ""),
      imageUrl: String(instance?.imageUrl || ""),
      rows: ensureRows(instance).rows.slice(0, 5).map(normalizeRow),
    };

    base.defaults = clone(nextDefaults);
    libraryOverrides[templateId] = clone(nextDefaults);
    writeLibraryOverrides(libraryOverrides);
  }

  function openEditor(section, index) {
    const templates = getSectionTemplates(section);
    const existing = templates[index];
    if (!existing) {
      openPicker(section);
      return;
    }
    editingTarget = { section: Number(section || 1), index: Number(index || 0) };
    renderEditor(ensureRows(existing));
  }

  function buildRowsEditor(rows) {
    return rows
      .map((row, index) => `
        <div class="template-row-editor">
          <div class="template-row-head">
            <strong>Row ${index + 1}</strong>
            <button class="btn warning template-icon-btn template-row-remove-btn" type="button" title="Remove row" aria-label="Remove row" onclick="window.TemplateSystem.removeEditorRow(${index})">X</button>
          </div>
          <div class="template-compact-checks">
            <label class="template-check-chip"><input data-row="${index}" data-field="hidden" type="checkbox" ${row.hidden ? "checked" : ""} /> Hide Row</label>
          </div>
          <div class="template-row-grid">
            <input data-row="${index}" data-field="label" value="${escapeHtml(row.label)}" placeholder="Label" />
            <input data-row="${index}" data-field="value" value="${escapeHtml(row.value)}" placeholder="Value / time" />
            <input data-row="${index}" data-field="price" value="${escapeHtml(row.price)}" placeholder="Price" />
            <input data-row="${index}" data-field="status" value="${escapeHtml(row.status)}" placeholder="Status" />
            <input data-row="${index}" data-field="meta" value="${escapeHtml(row.meta)}" placeholder="Meta / detail" />
            <div class="template-inline-stack">
              <input data-row="${index}" data-field="imageUrl" value="${escapeHtml(row.imageUrl || "")}" placeholder="Row image URL" />
              <div class="template-inline-actions">
                <input class="template-row-image-file template-file-inline" data-row-image-file="${index}" type="file" accept="image/png,image/jpeg,image/webp" />
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearRowField(${index}, 'imageUrl')">Hide</button>
              </div>
            </div>
          </div>
        </div>
      `)
      .join("");
  }

  function renderEditor(instance) {
    const overlay = ensureModal();
    const panel = document.getElementById("templateSystemPanel");
    const preview = buildTemplatePreviewMarkup(instance, { compact: false });
    panel.innerHTML = `
      <div class="template-modal-head">
        <div>
          <div class="template-modal-kicker">${escapeHtml(instance.category)}</div>
          <h3>${escapeHtml(instance.name)}</h3>
          <p>Fine-tune layout, spacing, row positioning, and styling with live preview control.</p>
        </div>
        <div class="template-head-actions">
          <button class="btn primary" type="button" onclick="window.TemplateSystem.backToPicker()">Back</button>
          <button class="btn warning" type="button" onclick="window.TemplateSystem.closeModal()">Close</button>
        </div>
      </div>
      <div class="template-editor-layout">
        <div class="template-editor-form">
          <div class="template-editor-section">
            <div class="template-editor-section-title">Visibility</div>
            <div class="template-compact-checks">
              <label class="template-check-chip"><input id="templateEditShowHeader" type="checkbox" ${instance.showHeader !== false ? "checked" : ""} /> Header</label>
              <label class="template-check-chip"><input id="templateEditShowTitle" type="checkbox" ${instance.showTitle !== false ? "checked" : ""} /> Title</label>
              <label class="template-check-chip"><input id="templateEditShowSubtitle" type="checkbox" ${instance.showSubtitle !== false ? "checked" : ""} /> Subtitle</label>
              <label class="template-check-chip"><input id="templateEditShowLogo" type="checkbox" ${instance.showLogo !== false ? "checked" : ""} /> Logo</label>
              <label class="template-check-chip"><input id="templateEditShowBadge" type="checkbox" ${instance.showBadge !== false ? "checked" : ""} /> Badge</label>
              <label class="template-check-chip"><input id="templateEditShowRows" type="checkbox" ${instance.showRows !== false ? "checked" : ""} /> Row Boxes</label>
              <label class="template-check-chip"><input id="templateEditShowRowImages" type="checkbox" ${instance.showRowImages !== false ? "checked" : ""} /> Row Images</label>
              <label class="template-check-chip"><input id="templateEditShowFeatureImage" type="checkbox" ${instance.showFeatureImage !== false ? "checked" : ""} /> Poster</label>
              <label class="template-check-chip"><input id="templateEditShowBackgroundImage" type="checkbox" ${instance.showBackgroundImage !== false ? "checked" : ""} /> Background</label>
            </div>
          </div>
          <div class="template-editor-section">
            <div class="template-editor-section-title">Content</div>
          <div class="template-editor-grid">
            <label>Category</label>
            <div class="template-inline-stack">
              <input id="templateEditCategory" type="text" value="${escapeHtml(instance.category || "")}" />
              <div class="template-inline-actions">
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearEditorField('templateEditCategory')">Clear</button>
              </div>
            </div>
            <label>Title</label>
            <div class="template-inline-stack">
              <input id="templateEditTitle" type="text" value="${escapeHtml(instance.titleText)}" />
              <div class="template-inline-actions">
                <input id="templateEditTitleColor" type="color" value="${escapeHtml(instance.titleColor || instance.primaryColor)}" title="Title font color" />
                <input id="templateEditTitleBgColor" type="color" value="${escapeHtml(instance.titleBgColor || instance.backgroundColor)}" title="Title background color" />
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.toggleEditorCheckbox('templateEditShowTitle', false)">Hide</button>
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearEditorField('templateEditTitle')">Clear</button>
              </div>
            </div>
            <label>Subtitle</label>
            <div class="template-inline-stack">
              <input id="templateEditSubtitle" type="text" value="${escapeHtml(instance.subtitleText)}" />
              <div class="template-inline-actions">
                <input id="templateEditSubtitleColor" type="color" value="${escapeHtml(instance.subtitleColor || instance.secondaryColor)}" title="Subtitle font color" />
                <input id="templateEditSubtitleBgColor" type="color" value="${escapeHtml(instance.subtitleBgColor || instance.backgroundColor)}" title="Subtitle background color" />
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.toggleEditorCheckbox('templateEditShowSubtitle', false)">Hide</button>
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearEditorField('templateEditSubtitle')">Clear</button>
              </div>
            </div>
            <label>Badge</label>
            <div class="template-inline-stack">
              <input id="templateEditBadge" type="text" value="${escapeHtml(instance.badgeText)}" />
              <div class="template-inline-actions">
                <input id="templateEditBadgeColor" type="color" value="${escapeHtml(instance.badgeColor || instance.primaryColor)}" title="Badge font color" />
                <input id="templateEditBadgeBgColor" type="color" value="${escapeHtml(instance.badgeBgColor || instance.primaryColor)}" title="Badge background color" />
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.toggleEditorCheckbox('templateEditShowBadge', false)">Hide</button>
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearEditorField('templateEditBadge')">Clear</button>
              </div>
            </div>
            <label>Primary Color</label>
            <input id="templateEditPrimary" type="color" value="${escapeHtml(instance.primaryColor)}" />
            <label>Secondary Color</label>
            <input id="templateEditSecondary" type="color" value="${escapeHtml(instance.secondaryColor)}" />
            <label>Background Color</label>
            <input id="templateEditBackground" type="color" value="${escapeHtml(instance.backgroundColor)}" />
            <label>Font Family</label>
            <select id="templateEditFontFamily">
              ${TEMPLATE_FONT_OPTIONS.map((option) => `
                <option value="${escapeHtml(option.value)}" ${String(instance.fontFamily || "system") === option.value ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `).join("")}
            </select>
            <label>Background Image URL</label>
            <div class="template-inline-stack">
              <input id="templateEditBackgroundImage" type="text" value="${escapeHtml(instance.backgroundImageUrl || "")}" placeholder="https://... or data:image/..." />
              <div class="template-inline-actions">
                <input id="templateEditBackgroundFile" class="template-file-inline" type="file" accept="image/png,image/jpeg,image/webp" />
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.toggleEditorCheckbox('templateEditShowBackgroundImage', false)">Hide</button>
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearEditorField('templateEditBackgroundImage')">Clear</button>
              </div>
            </div>
            <label>Base Font</label>
            <input id="templateEditScale" type="range" min="0.7" max="2" step="0.05" value="${escapeHtml(instance.fontScale)}" />
            <label>Canvas Padding</label>
            <input id="templateEditCanvasPaddingScale" type="range" min="0.7" max="2.4" step="0.05" value="${escapeHtml(instance.canvasPaddingScale || 1)}" />
            <label>Header Spacing</label>
            <input id="templateEditHeaderSpacingScale" type="range" min="0.6" max="2.5" step="0.05" value="${escapeHtml(instance.headerSpacingScale || 1)}" />
            <label>Body Start Gap</label>
            <input id="templateEditBodyTopScale" type="range" min="0.5" max="3" step="0.05" value="${escapeHtml(instance.bodyTopScale || 1)}" />
            <label>Title Size</label>
            <input id="templateEditTitleScale" type="range" min="0.7" max="2.4" step="0.05" value="${escapeHtml(instance.titleScale || 1)}" />
            <label>Subtitle Size</label>
            <input id="templateEditSubtitleScale" type="range" min="0.7" max="2.4" step="0.05" value="${escapeHtml(instance.subtitleScale || 1)}" />
            <label>Badge Size</label>
            <input id="templateEditBadgeScale" type="range" min="0.7" max="2.4" step="0.05" value="${escapeHtml(instance.badgeScale || 1)}" />
            <label>Logo Size</label>
            <input id="templateEditLogoScale" type="range" min="0.7" max="2.4" step="0.05" value="${escapeHtml(instance.logoScale || 1)}" />
            <label>Row Title Size</label>
            <div class="template-inline-stack">
              <input id="templateEditRowTextScale" type="range" min="0.7" max="2.6" step="0.05" value="${escapeHtml(instance.rowTextScale || 1)}" />
              <div class="template-inline-actions">
                <input id="templateEditRowTitleColor" type="color" value="${escapeHtml(instance.rowTitleColor || instance.secondaryColor)}" title="Row title color" />
              </div>
            </div>
            <label>Row Meta Size</label>
            <div class="template-inline-stack">
              <input id="templateEditRowMetaScale" type="range" min="0.7" max="2.6" step="0.05" value="${escapeHtml(instance.rowMetaScale || 1)}" />
              <div class="template-inline-actions">
                <input id="templateEditRowMetaColor" type="color" value="${escapeHtml(instance.rowMetaColor || instance.secondaryColor)}" title="Row meta color" />
                <input id="templateEditRowStatusColor" type="color" value="${escapeHtml(instance.rowStatusColor || instance.primaryColor)}" title="Row status color" />
              </div>
            </div>
            <label>Row Value Size</label>
            <div class="template-inline-stack">
              <input id="templateEditRowValueScale" type="range" min="0.7" max="2.8" step="0.05" value="${escapeHtml(instance.rowValueScale || 1)}" />
              <div class="template-inline-actions">
                <input id="templateEditRowValueColor" type="color" value="${escapeHtml(instance.rowValueColor || instance.secondaryColor)}" title="Row value color" />
              </div>
            </div>
            <label>Row Image Size</label>
            <input id="templateEditRowImageScale" type="range" min="0.7" max="2.4" step="0.05" value="${escapeHtml(instance.rowImageScale || 1)}" />
            <label>Row Gap</label>
            <input id="templateEditRowGapScale" type="range" min="0.7" max="${TEMPLATE_ROW_GAP_MAX}" step="0.05" value="${escapeHtml(instance.rowGapScale || 1)}" />
            <label>Row Box Size</label>
            <div class="template-inline-stack">
              <input id="templateEditRowBoxScale" type="range" min="0.7" max="${TEMPLATE_ROW_BOX_MAX}" step="0.05" value="${escapeHtml(instance.rowBoxScale || 1)}" />
              <div class="template-inline-actions">
                <input id="templateEditRowBoxBgColor" type="color" value="${escapeHtml(instance.rowBoxBgColor || instance.primaryColor)}" title="Row box background color" />
                <input id="templateEditRowBoxBorderColor" type="color" value="${escapeHtml(instance.rowBoxBorderColor || instance.primaryColor)}" title="Row box border color" />
              </div>
            </div>
            <label>Row Start Position</label>
            <select id="templateEditRowAnchor">
              <option value="top" ${normalizeRowAnchor(instance.rowAnchor) === "top" ? "selected" : ""}>Top</option>
              <option value="middle" ${normalizeRowAnchor(instance.rowAnchor) === "middle" ? "selected" : ""}>Middle</option>
              <option value="bottom" ${normalizeRowAnchor(instance.rowAnchor) === "bottom" ? "selected" : ""}>Bottom</option>
            </select>
            <label>Row Padding</label>
            <input id="templateEditRowPaddingScale" type="range" min="0.7" max="2.6" step="0.05" value="${escapeHtml(instance.rowPaddingScale || 1)}" />
            <label>Row Corner Radius</label>
            <input id="templateEditRowRadiusScale" type="range" min="0.7" max="2.8" step="0.05" value="${escapeHtml(instance.rowRadiusScale || 1)}" />
            <label>BG Zoom</label>
            <input id="templateEditBackgroundZoom" type="range" min="0.8" max="1.8" step="0.05" value="${escapeHtml(instance.backgroundZoom || 1)}" />
            <label>Logo URL</label>
            <div class="template-inline-stack">
              <input id="templateEditLogo" type="text" value="${escapeHtml(instance.logoUrl || "")}" placeholder="https://... or data:image/..." />
              <div class="template-inline-actions">
                <input id="templateEditLogoFile" class="template-file-inline" type="file" accept="image/png,image/jpeg,image/webp" />
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.toggleEditorCheckbox('templateEditShowLogo', false)">Hide</button>
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearEditorField('templateEditLogo')">Clear</button>
              </div>
            </div>
            <label>Poster / Feature Image URL</label>
            <div class="template-inline-stack">
              <input id="templateEditFeatureImage" type="text" value="${escapeHtml(instance.imageUrl || "")}" placeholder="https://... or data:image/..." />
              <div class="template-inline-actions">
                <input id="templateEditFeatureImageFile" class="template-file-inline" type="file" accept="image/png,image/jpeg,image/webp" />
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.toggleEditorCheckbox('templateEditShowFeatureImage', false)">Hide</button>
                <button class="btn warning template-tiny-btn" type="button" onclick="window.TemplateSystem.clearEditorField('templateEditFeatureImage')">Clear</button>
              </div>
            </div>
          </div>
          </div>
          <div class="template-editor-actions">
            <button class="btn primary" type="button" onclick="window.TemplateSystem.saveEditor()">Save Template</button>
          </div>
        </div>
        <div class="template-editor-preview template-editor-preview-stack">
          <div class="template-editor-preview-label">Live Preview</div>
          <div id="templateEditorPreview" class="template-editor-preview-canvas">${preview}</div>
          <div class="template-rows-wrap template-rows-under-preview">
            <div class="template-rows-head">
              <strong>Rows / Items</strong>
              <button class="btn primary template-mini-btn" type="button" onclick="window.TemplateSystem.addEditorRow()">Add Row</button>
            </div>
            <div id="templateRowsEditor" class="template-rows-list">${buildRowsEditor(instance.rows)}</div>
          </div>
        </div>
      </div>
    `;

    overlay.classList.remove("hidden");
    wireEditorEvents();
  }

  function collectEditorInstance() {
    const section = editingTarget?.section;
    const index = editingTarget?.index;
    const current = getSectionTemplates(section)[index];
    if (!current) return null;
    const rows = Array.from(document.querySelectorAll("#templateRowsEditor [data-row]")).reduce((acc, input) => {
      const rowIndex = Number(input.getAttribute("data-row") || 0);
      const field = String(input.getAttribute("data-field") || "");
      if (!acc[rowIndex]) acc[rowIndex] = { label: "", value: "", meta: "", status: "", price: "", imageUrl: "", hidden: false };
      acc[rowIndex][field] = input.type === "checkbox" ? !!input.checked : input.value || "";
      return acc;
    }, []);
    return ensureRows({
      ...current,
      category: document.getElementById("templateEditCategory")?.value || "",
      titleText: document.getElementById("templateEditTitle")?.value || "",
      subtitleText: document.getElementById("templateEditSubtitle")?.value || "",
      badgeText: document.getElementById("templateEditBadge")?.value || "",
      titleColor: document.getElementById("templateEditTitleColor")?.value || "",
      titleBgColor: document.getElementById("templateEditTitleBgColor")?.value || "",
      subtitleColor: document.getElementById("templateEditSubtitleColor")?.value || "",
      subtitleBgColor: document.getElementById("templateEditSubtitleBgColor")?.value || "",
      badgeColor: document.getElementById("templateEditBadgeColor")?.value || "",
      badgeBgColor: document.getElementById("templateEditBadgeBgColor")?.value || "",
      rowTitleColor: document.getElementById("templateEditRowTitleColor")?.value || "",
      rowMetaColor: document.getElementById("templateEditRowMetaColor")?.value || "",
      rowValueColor: document.getElementById("templateEditRowValueColor")?.value || "",
      rowStatusColor: document.getElementById("templateEditRowStatusColor")?.value || "",
      rowBoxBgColor: document.getElementById("templateEditRowBoxBgColor")?.value || "",
      rowBoxBorderColor: document.getElementById("templateEditRowBoxBorderColor")?.value || "",
      showHeader: !!document.getElementById("templateEditShowHeader")?.checked,
      showTitle: !!document.getElementById("templateEditShowTitle")?.checked,
      showSubtitle: !!document.getElementById("templateEditShowSubtitle")?.checked,
      showLogo: !!document.getElementById("templateEditShowLogo")?.checked,
      showBadge: !!document.getElementById("templateEditShowBadge")?.checked,
      showRows: !!document.getElementById("templateEditShowRows")?.checked,
      showRowImages: !!document.getElementById("templateEditShowRowImages")?.checked,
      showFeatureImage: !!document.getElementById("templateEditShowFeatureImage")?.checked,
      showBackgroundImage: !!document.getElementById("templateEditShowBackgroundImage")?.checked,
      primaryColor: document.getElementById("templateEditPrimary")?.value || current.primaryColor,
      secondaryColor: document.getElementById("templateEditSecondary")?.value || current.secondaryColor,
      backgroundColor: document.getElementById("templateEditBackground")?.value || current.backgroundColor,
      fontFamily: document.getElementById("templateEditFontFamily")?.value || current.fontFamily || "system",
      backgroundImageUrl: document.getElementById("templateEditBackgroundImage")?.value || "",
      fontScale: Number(document.getElementById("templateEditScale")?.value || current.fontScale || 1),
      canvasPaddingScale: Number(document.getElementById("templateEditCanvasPaddingScale")?.value || current.canvasPaddingScale || 1),
      headerSpacingScale: Number(document.getElementById("templateEditHeaderSpacingScale")?.value || current.headerSpacingScale || 1),
      bodyTopScale: Number(document.getElementById("templateEditBodyTopScale")?.value || current.bodyTopScale || 1),
      titleScale: Number(document.getElementById("templateEditTitleScale")?.value || current.titleScale || 1),
      subtitleScale: Number(document.getElementById("templateEditSubtitleScale")?.value || current.subtitleScale || 1),
      badgeScale: Number(document.getElementById("templateEditBadgeScale")?.value || current.badgeScale || 1),
      logoScale: Number(document.getElementById("templateEditLogoScale")?.value || current.logoScale || 1),
      rowTextScale: Number(document.getElementById("templateEditRowTextScale")?.value || current.rowTextScale || 1),
      rowMetaScale: Number(document.getElementById("templateEditRowMetaScale")?.value || current.rowMetaScale || 1),
      rowValueScale: Number(document.getElementById("templateEditRowValueScale")?.value || current.rowValueScale || 1),
      rowImageScale: Number(document.getElementById("templateEditRowImageScale")?.value || current.rowImageScale || 1),
      rowGapScale: Number(document.getElementById("templateEditRowGapScale")?.value || current.rowGapScale || 1),
      rowBoxScale: Number(document.getElementById("templateEditRowBoxScale")?.value || current.rowBoxScale || 1),
      rowAnchor: document.getElementById("templateEditRowAnchor")?.value || current.rowAnchor || "top",
      rowPaddingScale: Number(document.getElementById("templateEditRowPaddingScale")?.value || current.rowPaddingScale || 1),
      rowRadiusScale: Number(document.getElementById("templateEditRowRadiusScale")?.value || current.rowRadiusScale || 1),
      backgroundZoom: Number(document.getElementById("templateEditBackgroundZoom")?.value || current.backgroundZoom || 1),
      logoUrl: document.getElementById("templateEditLogo")?.value || "",
      imageUrl: document.getElementById("templateEditFeatureImage")?.value || "",
      rows: rows.filter(Boolean).map(normalizeRow).slice(0, 5),
    });
  }

  function wireEditorEvents() {
    const previewTarget = document.getElementById("templateEditorPreview");
    const rerender = () => {
      const instance = collectEditorInstance();
      if (!instance || !previewTarget) return;
      previewTarget.innerHTML = buildTemplatePreviewMarkup(instance, { compact: false });
    };
    Array.from(document.querySelectorAll("#templateSystemPanel input")).forEach((input) => {
      input.addEventListener("input", rerender);
      input.addEventListener("change", rerender);
    });
    Array.from(document.querySelectorAll("#templateSystemPanel select")).forEach((input) => {
      input.addEventListener("change", rerender);
    });
    Array.from(document.querySelectorAll("[data-row-image-file]")).forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (Number(file.size || 0) > 6 * 1024 * 1024) {
          alert("Please use a row image under 6 MB.");
          event.target.value = "";
          return;
        }
        const dataUrl = await imageFileToDataUrl(file, {
          maxWidth: 420,
          maxHeight: 420,
          quality: 0.82,
          mimeType: "image/webp",
        });
        const rowIndex = String(event?.target?.getAttribute("data-row-image-file") || "");
        const urlInput = document.querySelector(`[data-row="${rowIndex}"][data-field="imageUrl"]`);
        if (urlInput) urlInput.value = dataUrl;
        rerender();
      });
    });
    const upload = document.getElementById("templateEditLogoFile");
    if (upload) {
      upload.addEventListener("change", async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (Number(file.size || 0) > 6 * 1024 * 1024) {
          alert("Please use an image under 6 MB for template logos.");
          event.target.value = "";
          return;
        }
        const dataUrl = await imageFileToDataUrl(file, {
          maxWidth: 420,
          maxHeight: 420,
          quality: 0.82,
          mimeType: "image/webp",
        });
        const urlInput = document.getElementById("templateEditLogo");
        if (urlInput) urlInput.value = dataUrl;
        rerender();
      });
    }
    const featureUpload = document.getElementById("templateEditFeatureImageFile");
    if (featureUpload) {
      featureUpload.addEventListener("change", async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (Number(file.size || 0) > 6 * 1024 * 1024) {
          alert("Please use a feature image under 6 MB.");
          event.target.value = "";
          return;
        }
        const dataUrl = await imageFileToDataUrl(file, {
          maxWidth: 900,
          maxHeight: 1400,
          quality: 0.84,
          mimeType: "image/webp",
        });
        const urlInput = document.getElementById("templateEditFeatureImage");
        if (urlInput) urlInput.value = dataUrl;
        rerender();
      });
    }
    const backgroundUpload = document.getElementById("templateEditBackgroundFile");
    if (backgroundUpload) {
      backgroundUpload.addEventListener("change", async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (Number(file.size || 0) > 8 * 1024 * 1024) {
          alert("Please use a background image under 8 MB.");
          event.target.value = "";
          return;
        }
        const dataUrl = await imageFileToDataUrl(file, {
          maxWidth: 1600,
          maxHeight: 900,
          quality: 0.8,
          mimeType: "image/webp",
        });
        const urlInput = document.getElementById("templateEditBackgroundImage");
        if (urlInput) urlInput.value = dataUrl;
        rerender();
      });
    }
  }

  function imageFileToDataUrl(file, options) {
    const settings = options && typeof options === "object" ? options : {};
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          try {
            const maxWidth = Math.max(1, Number(settings.maxWidth || image.width || 1));
            const maxHeight = Math.max(1, Number(settings.maxHeight || image.height || 1));
            const ratio = Math.min(
              1,
              maxWidth / Math.max(1, image.width),
              maxHeight / Math.max(1, image.height)
            );
            const width = Math.max(1, Math.round(image.width * ratio));
            const height = Math.max(1, Math.round(image.height * ratio));
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            if (!context) {
              resolve(String(reader.result || ""));
              return;
            }
            context.drawImage(image, 0, 0, width, height);
            const mimeType = String(settings.mimeType || "image/webp");
            const quality = Math.max(0.4, Math.min(0.92, Number(settings.quality || 0.82)));
            try {
              resolve(canvas.toDataURL(mimeType, quality));
            } catch {
              resolve(canvas.toDataURL("image/jpeg", quality));
            }
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = () => reject(new Error("image-read-failed"));
        image.src = String(reader.result || "");
      };
      reader.onerror = () => reject(new Error("file-read-failed"));
      reader.readAsDataURL(file);
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("file-read-failed"));
      reader.readAsDataURL(file);
    });
  }

  function clearEditorField(fieldId) {
    const input = document.getElementById(String(fieldId || ""));
    if (!input) return;
    if ("value" in input) {
      input.value = "";
    }
    const previewTarget = document.getElementById("templateEditorPreview");
    const instance = collectEditorInstance();
    if (!instance || !previewTarget) return;
    previewTarget.innerHTML = buildTemplatePreviewMarkup(instance, { compact: false });
  }

  function toggleEditorCheckbox(fieldId, checked) {
    const input = document.getElementById(String(fieldId || ""));
    if (!input) return;
    input.checked = !!checked;
    const previewTarget = document.getElementById("templateEditorPreview");
    const instance = collectEditorInstance();
    if (!instance || !previewTarget) return;
    previewTarget.innerHTML = buildTemplatePreviewMarkup(instance, { compact: false });
  }

  function clearRowField(rowIndex, field) {
    const input = document.querySelector(`[data-row="${Number(rowIndex || 0)}"][data-field="${String(field || "")}"]`);
    if (!input) return;
    input.value = "";
    const previewTarget = document.getElementById("templateEditorPreview");
    const instance = collectEditorInstance();
    if (!instance || !previewTarget) return;
    previewTarget.innerHTML = buildTemplatePreviewMarkup(instance, { compact: false });
  }

  function addEditorRow() {
    const current = collectEditorInstance();
    if (!current) return;
    if (current.rows.length >= 5) {
      window.showNotice?.("warning", "Row Limit Reached", "A template can have up to 5 rows.");
      return;
    }
    current.rows.push({ label: "New Item", value: "", meta: "", status: "", price: "", imageUrl: "" });
    renderEditor(current);
  }

  function removeEditorRow(rowIndex) {
    const current = collectEditorInstance();
    if (!current) return;
    current.rows.splice(Number(rowIndex || 0), 1);
    if (!current.rows.length) {
      current.rows.push({ label: "Item 1", value: "", meta: "", status: "", price: "", imageUrl: "" });
    }
    renderEditor(current);
  }

  function saveEditor() {
    const next = collectEditorInstance();
    if (!next || !editingTarget) return;
    persistTemplateAsDefault(next);
    const current = getSectionTemplates(editingTarget.section).slice();
    current[editingTarget.index] = next;
    setSectionTemplates(editingTarget.section, current);
    triggerSectionPreviewRefresh();
    window.showNotice?.("success", "Template Saved", "Template changes saved successfully.");
    setTimeout(() => {
      closeModal();
    }, 120);
  }

  function backToPicker() {
    if (!editingTarget) return closeModal();
    pickerSection = editingTarget.section;
    renderPicker();
  }

  function buildTemplatePreviewMarkup(instance, options) {
    if (!instance) return '<div class="template-render-empty">Template unavailable</div>';
    const metrics = getPreviewMetrics(instance, {
      compact: !!options?.compact,
      width: options?.width,
      height: options?.height,
      rowCount:
        instance.showRows === false
          ? 0
          : Array.isArray(instance.rows)
          ? instance.rows.filter((row) => row?.hidden !== true).length
          : 0,
    });
    const compact = metrics.compact;
    const rows = instance.showRows === false ? [] : (instance.rows || []).filter((row) => row?.hidden !== true).slice(0, metrics.rowLimit);
    const titleColor = resolveColor(instance.titleColor, instance.primaryColor);
    const titleBgColor = resolveColor(instance.titleBgColor, "transparent");
    const subtitleColor = resolveColor(instance.subtitleColor, withAlpha(instance.secondaryColor, 0.72));
    const subtitleBgColor = resolveColor(instance.subtitleBgColor, "transparent");
    const badgeColor = resolveColor(instance.badgeColor, instance.primaryColor);
    const badgeBgColor = resolveColor(instance.badgeBgColor, withAlpha(instance.primaryColor, 0.24));
    const rowTitleColor = resolveColor(instance.rowTitleColor, instance.secondaryColor);
    const rowMetaColor = resolveColor(instance.rowMetaColor, withAlpha(instance.secondaryColor, 0.72));
    const rowValueColor = resolveColor(instance.rowValueColor, instance.secondaryColor);
    const rowStatusColor = resolveColor(instance.rowStatusColor, instance.primaryColor);
    const rowBoxBgColor = resolveColor(instance.rowBoxBgColor, withAlpha(instance.primaryColor, 0.18));
    const rowBoxBorderColor = resolveColor(instance.rowBoxBorderColor, withAlpha(instance.primaryColor, 0.34));
    const rootStyle = [
      `--tpl-primary:${instance.primaryColor}`,
      `--tpl-secondary:${instance.secondaryColor}`,
      `--tpl-bg:${instance.backgroundColor}`,
      `--tpl-font-family:${resolveTemplateWebFont(instance.fontFamily)}`,
      `--tpl-shell-bg:${instance.backgroundImageUrl && instance.showBackgroundImage !== false ? "transparent" : instance.backgroundColor}`,
      `--tpl-overlay:${
        instance.backgroundImageUrl && instance.showBackgroundImage !== false
          ? "linear-gradient(rgba(4, 10, 16, 0.12), rgba(4, 10, 16, 0.12))"
          : "none"
      }`,
      `--tpl-surface:${rowBoxBgColor}`,
      `--tpl-border:${rowBoxBorderColor}`,
      `--tpl-muted:${rowMetaColor}`,
      `--tpl-title-color:${titleColor}`,
      `--tpl-title-bg:${titleBgColor}`,
      `--tpl-subtitle-color:${subtitleColor}`,
      `--tpl-subtitle-bg:${subtitleBgColor}`,
      `--tpl-badge-color:${badgeColor}`,
      `--tpl-badge-bg:${badgeBgColor}`,
      `--tpl-row-title-color:${rowTitleColor}`,
      `--tpl-row-meta-color:${rowMetaColor}`,
      `--tpl-row-value-color:${rowValueColor}`,
      `--tpl-row-status-color:${rowStatusColor}`,
      `--tpl-scale:${instance.fontScale}`,
      ...metrics.vars,
      instance.backgroundImageUrl && instance.showBackgroundImage !== false
        ? `--tpl-bg-image:url("${String(instance.backgroundImageUrl).replace(/"/g, "&quot;")}")`
        : "--tpl-bg-image:none",
    ].join(";");

    const logoSource = instance.logoUrl || (instance.showFeatureImage !== false ? instance.imageUrl : "");
    const logo = instance.showLogo === false
      ? ""
      : logoSource
      ? `<img class="template-render-logo" src="${escapeHtml(logoSource)}" alt="" />`
      : `<div class="template-render-logo-placeholder">${escapeHtml(instance.category.split(" ")[0] || "TPL")}</div>`;
    const heroImage = instance.imageUrl && instance.showFeatureImage !== false
      ? `<div class="template-render-guest-image-wrap"><img class="template-render-guest-image" src="${escapeHtml(instance.imageUrl)}" alt="" /></div>`
      : "";

    const header = instance.showHeader === false ? "" : `
      <div class="template-render-head">
        ${instance.showLogo === false ? "" : `<div class="template-render-brand">${logo}</div>`}
        <div class="template-render-copy">
          <div class="template-render-kicker">${escapeHtml(instance.category || "Featured Template")}</div>
          ${instance.showTitle === false ? "" : `<div class="template-render-title">${escapeHtml(instance.titleText)}</div>`}
          ${instance.subtitleText && instance.showSubtitle !== false ? `<div class="template-render-subtitle">${escapeHtml(instance.subtitleText)}</div>` : ""}
        </div>
        ${instance.badgeText && instance.showBadge !== false ? `<div class="template-render-badge">${escapeHtml(instance.badgeText)}</div>` : ""}
      </div>
    `;

    let body = "";
    if (instance.layout === "schedule-board") {
      body = `
        <div class="template-render-board template-render-body-block">
          ${rows.map((row) => `
            <div class="template-render-row">
              <div class="template-render-row-main">
                <strong>${escapeHtml(row.label)}</strong>
                <span>${escapeHtml(row.meta)}</span>
              </div>
              <div class="template-render-row-side">
                <em>${escapeHtml(row.value || row.price)}</em>
                <span>${escapeHtml(row.status)}</span>
              </div>
              ${row.imageUrl && instance.showRowImages !== false ? `<div class="template-render-row-image-wrap"><img class="template-render-row-image" src="${escapeHtml(row.imageUrl)}" alt="" /></div>` : ""}
            </div>
          `).join("")}
        </div>
      `;
    } else if (instance.layout === "metric-cards") {
      body = `
        <div class="template-render-metrics template-render-body-block">
          ${rows.map((row) => `
            <div class="template-render-metric">
              <div class="template-render-metric-head">
                <span>${escapeHtml(row.label)}</span>
                ${row.imageUrl && instance.showRowImages !== false ? `<div class="template-render-metric-image-wrap"><img class="template-render-row-image" src="${escapeHtml(row.imageUrl)}" alt="" /></div>` : ""}
              </div>
              <strong>${escapeHtml(row.value || row.price)}</strong>
              <small>${escapeHtml(row.meta || row.status)}</small>
            </div>
          `).join("")}
        </div>
      `;
    } else if (instance.layout === "price-board") {
      body = `
        <div class="template-render-price-list template-render-body-block">
          ${rows.map((row) => `
            <div class="template-render-price-item">
              <div>
                <strong>${escapeHtml(row.label)}</strong>
                <span>${escapeHtml(row.meta)}</span>
              </div>
              <div class="template-render-price-side">
                <em>${escapeHtml(row.price || row.value)}</em>
                <span>${escapeHtml(row.status)}</span>
              </div>
              ${row.imageUrl && instance.showRowImages !== false ? `<div class="template-render-row-image-wrap"><img class="template-render-row-image" src="${escapeHtml(row.imageUrl)}" alt="" /></div>` : ""}
            </div>
          `).join("")}
        </div>
      `;
    } else if (instance.layout === "welcome-guest") {
      body = `
        <div class="template-render-guest-poster">
          <div class="template-render-guest-copy">
            <div class="template-render-guest-hero">
              ${instance.showTitle === false ? "" : `<strong>${escapeHtml(instance.titleText)}</strong>`}
              ${instance.subtitleText && instance.showSubtitle !== false ? `<small>${escapeHtml(instance.subtitleText)}</small>` : ""}
            </div>
            ${rows.length ? `
              <div class="template-render-guest-details-shell">
                <div class="template-render-guest-details">
                  ${rows.map((row) => `
                    <div class="template-render-guest-detail">
                      <span>${escapeHtml(row.label)}</span>
                      <strong>${escapeHtml(row.value || row.price)}</strong>
                      <small>${escapeHtml(row.meta || row.status)}</small>
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : ""}
          </div>
          ${heroImage}
        </div>
      `;
    } else {
      body = `
        <div class="template-render-list template-render-body-block">
          ${rows.map((row) => `
            <div class="template-render-list-item">
              <div class="template-render-list-main">
                <strong>${escapeHtml(row.label)}</strong>
                <small>${escapeHtml(row.meta || row.status)}</small>
              </div>
              <div class="template-render-list-side">
                <span>${escapeHtml(row.value || row.price)}</span>
              </div>
              ${row.imageUrl && instance.showRowImages !== false ? `<div class="template-render-row-image-wrap"><img class="template-render-row-image" src="${escapeHtml(row.imageUrl)}" alt="" /></div>` : ""}
            </div>
          `).join("")}
        </div>
      `;
    }

    return `<div class="template-render template-render-layout-${escapeHtml(instance.layout || "list-focus")} ${compact ? "is-compact" : ""}" style="${rootStyle}">${header}${body}</div>`;
  }

  function renderPreviewInto(container, sectionConfig, activeTemplate) {
    const playlist = Array.isArray(sectionConfig?.templatePlaylist) && sectionConfig.templatePlaylist.length
      ? sectionConfig.templatePlaylist
      : sectionConfig?.templateConfig
      ? [sectionConfig.templateConfig]
      : [];
    const resolved = activeTemplate
      ? buildTemplateInstance(activeTemplate?.templateId || activeTemplate?.id || "", activeTemplate)
      : buildTemplateInstance(playlist[0]?.templateId || playlist[0]?.id || "", playlist[0]);
    if (!resolved) return false;
    const wrap = document.createElement("div");
    wrap.className = "preview-template-host";
    wrap.innerHTML = buildTemplatePreviewMarkup(resolved, {
      compact: false,
      width: Math.max(120, Number(container?.clientWidth || 0)),
      height: Math.max(120, Number(container?.clientHeight || 0)),
    });
    container.appendChild(wrap);
    return true;
  }

  function init(options) {
    changeListener = typeof options?.onChange === "function" ? options.onChange : null;
    [1, 2, 3].forEach((section) => renderSectionSummary(section));
  }

  window.TemplateSystem = {
    SOURCE_TYPE,
    library: TEMPLATE_LIBRARY,
    init,
    openPicker,
    closeModal,
    toggleSelection,
    pickAndEdit,
    openEditor,
    removeTemplate,
    hydrateSection,
    getSectionConfig,
    getSectionTemplates,
    renderPreviewInto,
    addEditorRow,
    removeEditorRow,
    clearEditorField,
    clearRowField,
    toggleEditorCheckbox,
    saveEditor,
    backToPicker,
  };
})();
