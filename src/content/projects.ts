import type { Project } from "@/types/content";

/** Facts below come from the project READMEs in the owner's repositories (Ops Suite: from this repository). */
export const projects: Project[] = [
  {
    slug: "ops-suite",
    index: "01",
    title: "Ops Suite: a CRM, ERP and Data Portal on One Database",
    client: "Self-initiated · product demo",
    tags: ["AI Automation", "Full-stack", "Data"],
    year: "2026",
    summary:
      "A working operations suite for an Indian B2B distributor: CRM, ERP and a data portal on one database, with automated cross-module flows, a plain-English question box, and the evaluation to prove it works.",
    cover: "/work/ops-suite-dashboard.webp",
    gallery: ["/work/ops-suite-dashboard.webp", "/work/ops-suite-board.webp", "/work/ops-suite-order.webp", "/work/ops-suite-import.webp", "/work/ops-suite-ask.webp", "/work/ops-suite-collections.webp"],
    problem:
      "Small and mid-sized distributors run sales, stock and money in separate tools, so every hand-off — a won deal becoming an order, an order becoming an invoice, stock running low — is a manual step, and a simple question needs an analyst.",
    contribution:
      "Designed and built the whole product end to end: every screen, the business rules that connect the modules, role permissions, data imports, the dashboard, the AI question box and the way its quality is measured.",
    results: [
      { label: "Modules on one database", value: "3" },
      { label: "Automated tests", value: "204" },
      { label: "Business metrics you can ask about", value: "16" },
      { label: "Fixed questions the AI is graded on", value: "33" },
    ],
    lessons: [
      "An AI answer people can check — with its working shown — gets trusted and used; a black box doesn't.",
      "An evaluation is only honest if it tests exactly what users get, and fails loudly when the two drift apart.",
      "Most of the value is in the boring connections: reservations, partial receipts, payment rules and an audit trail.",
    ],
    featured: true,
    demoUrl: "/demos/ops-suite",
  },
  {
    slug: "docdesk",
    index: "02",
    title: "DocDesk: Answers, Fields and Checks from Business Documents",
    client: "Self-initiated · product demo",
    tags: ["AI Automation", "Document Intelligence", "Full-stack"],
    year: "2026",
    summary:
      "A document desk for Indian businesses: ask a contract a question and see the exact clause highlighted, turn invoices into checked data, match invoices to purchase orders, and redline contract versions.",
    cover: "/work/docdesk-ask.webp",
    gallery: ["/work/docdesk-ask.webp", "/work/docdesk-checks.webp", "/work/docdesk-match.webp", "/work/docdesk-redline.webp", "/work/docdesk-fields.webp", "/work/docdesk-quality.webp"],
    problem:
      "Finance, legal and HR teams still read the same PDFs line by line: hunting for a notice period, retyping invoice totals, checking each line against the purchase order. It is slow, mistakes slip through, and nobody can show where a number came from.",
    contribution:
      "Designed and built the whole product: the document library and reader, question answering that cites the page, field extraction with human approval and export, invoice and contract checks, order-to-invoice matching, version redlines, a review queue, and the quality report that grades it.",
    results: [
      { label: "Questions answered correctly", value: "100%" },
      { label: "Answers citing the right clause", value: "100%" },
      { label: "Fields extracted correctly", value: "90/90" },
      { label: "Typical answer time", value: "0.9 s" },
    ],
    lessons: [
      "People trust an answer they can check in one click; a highlighted clause does more than any confidence score.",
      "The cheapest AI call is the one you don't make: rules read most invoice fields, so the model only fills the gaps.",
      "Saying “the document doesn't say” is a feature — the quality set includes traps for exactly that.",
    ],
    featured: true,
    demoUrl: "/demos/document-intelligence",
  },
  {
    slug: "front-desk-voice",
    index: "03",
    title: "Front Desk Voice: A Phone Agent That Books, Answers and Hands Over",
    client: "Self-initiated · product demo",
    tags: ["AI Automation", "Voice AI", "Conversational Agents"],
    year: "2026",
    summary:
      "An after-hours front desk you can talk to. It books appointments from the clinic's real calendar, rebooks when the caller changes their mind, answers questions, hands urgent calls to a person and leaves staff a one-line note. A second line answers questions about Azad's work out loud.",
    cover: "/work/voice-booking.webp",
    gallery: ["/work/voice-booking.webp", "/work/voice-call.webp", "/work/voice-change.webp", "/work/voice-urgent.webp", "/work/voice-about.webp"],
    problem:
      "Small clinics and service businesses lose bookings every evening: the phone rings, nobody picks up, and the caller tries someone else. Voice bots that do pick up often guess, offer times that don't exist, or trap people who need a human.",
    contribution:
      "Designed and built the whole product: the conversation, booking against a live calendar, changes and corrections mid-call, clinic questions, safe handover for emergencies and requests it shouldn't handle, staff notes, talking over the agent, sample calls, and the test set that grades it. Plus a second line that turns the site's assistant into a voice you can question.",
    results: [
      { label: "Test calls handled correctly", value: "21/21" },
      { label: "Test recordings understood", value: "88%" },
      { label: "Speech to text", value: "0.4 s" },
      { label: "First word of an answer about Azad", value: "1.1 s" },
    ],
    lessons: [
      "Never let a voice agent make up a time: it only ever offers slots the calendar says are free.",
      "Most of a call is simple, so most turns are decided instantly; the hard ones get more care, and the caller can always reach a person.",
      "Names are the hardest thing to hear, so the agent reads every booking back and the caller can correct it in one line.",
    ],
    featured: true,
    demoUrl: "/demos/voice-ai",
  },
  {
    slug: "surroundsense",
    repo: "https://github.com/thisz-akj/surroundsense",
    index: "04",
    title: "SurroundSense: 360° Blind-Spot Monitoring from Four Fisheye Cameras",
    client: "Self-initiated · Driver assistance",
    tags: ["Computer Vision", "Geometric Vision", "ADAS"],
    year: "2026",
    summary:
      "A real-time perception pipeline that turns four fisheye cameras into one 360° bird's-eye view, finds the vehicles around the car, and warns when one is in a blind spot.",
    cover: "/work/cv-surroundsense.webp",
    gallery: ["/work/cv-surroundsense.webp", "/work/cv-surroundsense-2.webp"],
    clip: "/video/cv-surroundsense.mp4",
    problem:
      "Mirrors leave blind spots, and a single camera can't see all around a car. Fisheye lenses cover everything but bend the world, so every detection has to be straightened out and placed on the road before it means anything.",
    contribution:
      "Built the whole pipeline: a 360° top-down view stitched from four fisheye cameras, object detection running on edge hardware, every detection placed on the ground, the four cameras fused into one picture around the car, and blind-spot zones that raise and clear warnings. Validated on recorded datasets and on live camera streams.",
    results: [
      { label: "Fisheye cameras fused", value: "4" },
      { label: "Coverage around the car", value: "360°" },
      { label: "Validated on", value: "Datasets + live streams" },
      { label: "Runs", value: "Real time, on the edge" },
    ],
    lessons: [
      "A detection only matters once you know where it is on the road: the geometry counts as much as the detector.",
      "Fisheye coverage is a gift and a headache: you see everything, bent.",
    ],
    usp: [
      "Sees all the way round with four cameras and no extra sensors.",
      "Every detection is placed on the road in metres, so warnings are about real distance, not pixels.",
      "Proven on live camera streams, not only on recorded data.",
    ],
    industries: [
      { name: "Car makers & suppliers", use: "Blind-spot and surround-view features for passenger cars." },
      { name: "Trucks, buses & fleets", use: "Long vehicles have huge blind spots; cover them with cameras already fitted." },
      { name: "Mining & construction", use: "Warnings around heavy machinery where people work close by." },
      { name: "AMRs & forklifts", use: "360° awareness for vehicles moving between people in warehouses." },
    ],
    featured: true,
  },
  {
    slug: "edge-pose-estimation",
    repo: "https://github.com/thisz-akj/ros2-ml-accelerator-pipeline",
    index: "05",
    title: "Real-Time Pose Estimation for Industrial Trolleys, on an Edge Device",
    client: "Industrial robotics",
    tags: ["Computer Vision", "Edge AI", "Robotics"],
    year: "2026",
    summary:
      "Corners, wheels and handles of industrial trolleys found and tracked in real time on a small edge accelerator: twice as fast as the unoptimised model, with keypoint accuracy held.",
    cover: "/work/cv-trolley-pose.webp",
    gallery: ["/work/cv-trolley-pose.webp"],
    clip: "/video/cv-trolley-pose.mp4",
    problem:
      "A robot that moves trolleys needs to know exactly where each corner, wheel and handle is, many times a second, on hardware small enough to ride on the robot.",
    contribution:
      "Fitted a multi-head keypoint model to an edge accelerator and owned the whole path from trained model to the program running on the device, doubling speed while keeping keypoints accurate enough for real-time tracking.",
    results: [
      { label: "Faster on the edge device", value: "2×" },
      { label: "Keypoint accuracy", value: "Held" },
      { label: "Used for", value: "Real-time tracking" },
    ],
    lessons: ["The only speed that counts is the speed on the target device, so measure there from day one."],
    usp: [
      "Real time on a chip small enough to ride on the robot.",
      "Twice as fast without giving up keypoint accuracy.",
      "Owned end to end: from the trained model to the program running on the device.",
    ],
    industries: [
      { name: "Warehouse robotics", use: "Robots that dock under, tow and position trolleys and carts." },
      { name: "Manufacturing", use: "Track fixtures, carts and parts moving along the line." },
      { name: "Hospitals & logistics", use: "Autonomous carts that collect and deliver trolleys." },
      { name: "Retail back-of-store", use: "Track cages and roll containers as they move." },
    ],
    featured: true,
  },
  {
    slug: "targetless-camera-lidar-calibration",
    repo: "https://github.com/thisz-akj/Visual_lidar_calibration_tool",
    index: "06",
    title: "Targetless Camera–LiDAR Calibration",
    client: "Visual LiDAR Calibration Tool",
    tags: ["Perception", "Calibration", "Tooling"],
    year: "2026",
    summary:
      "Line up a camera and a LiDAR without a calibration board: the scan lands on the right pixels, checked against people in the scene, with a tool anyone on the team can run.",
    cover: "/work/cv-calibration.webp",
    gallery: ["/work/cv-calibration.webp", "/work/04_calibrate_viewer_overlay.webp", "/work/03_preprocess_viewer_pointcloud.webp", "/work/01_main_window_idle.webp"],
    problem:
      "Sensor fusion breaks when camera and LiDAR disagree about where things are. Board-based calibration is slow and impractical in the field.",
    contribution:
      "Built a targetless calibration pipeline and packaged it as a tool: matching what the camera and the LiDAR both see, solving for how the sensors sit relative to each other, and checking the result by projecting people's scans onto their outlines in the image. A desktop app with one button per stage, plus a command-line mode for batch runs.",
    results: [
      { label: "LiDAR points on the person mask", value: ">95%" },
      { label: "Sensor setups validated", value: "Several" },
      { label: "Calibration target", value: "None needed" },
    ],
    lessons: ["The best algorithm is useless if only its author can run it — the GUI mattered as much as the optimiser."],
    usp: [
      "No calibration board: it works with whatever is in the scene.",
      "Checked on people in the scene: more than 95% of their LiDAR points land on their outline in the image.",
      "A tool, not a script: one button per stage, so field teams can re-calibrate on their own.",
    ],
    industries: [
      { name: "Autonomous vehicles", use: "Keep camera and LiDAR aligned after bumps, repairs and sensor swaps." },
      { name: "Robotics & AMRs", use: "Fast re-calibration in the field, with no lab and no board." },
      { name: "Mapping & surveying", use: "Colour-accurate 3D scans from camera and LiDAR rigs." },
      { name: "Drones & security", use: "Fused sensing that stays aligned over time." },
    ],
    featured: true,
    clip: "/video/cv-calibration.mp4",
  },  {
    slug: "visual-slam-to-navigation",
    repo: "https://github.com/thisz-akj/Visual-Slam2Nav",
    index: "07",
    title: "Visual SLAM to Navigation: a Robot Maps a Room and Drives Itself",
    client: "Self-initiated · Robotics",
    tags: ["Robotics", "Visual SLAM", "3D Mapping"],
    year: "2026",
    summary:
      "A camera moves through a room; visual SLAM works out where it is and builds a 3D map; the map becomes a navigation map, and a robot plans and drives its own routes inside it.",
    cover: "/work/cv-slam-map.webp",
    gallery: ["/work/cv-slam-map.webp", "/work/cv-slam-map-2.webp", "/work/gz_hd_oblique.webp", "/work/apt0_map_topdown.webp", "/work/nav_route.webp"],
    clip: "/video/cv-slam-map.mp4",
    problem:
      "A robot can only go where its map says it can. Building that map by hand is slow, and camera tracking that loses its place in a bare corridor or a dark corner leaves holes that send the robot the wrong way.",
    contribution:
      "Built the whole chain: camera video, visual SLAM (two pipelines side by side, one with classic features and one with learned features, the second written from scratch), a dense 3D map of the room, a levelled and squared digital twin of a real apartment, a navigation map with keep-out margins, and a robot that plans and drives its own routes. Every run is scored against exact ground truth, on a laptop without a GPU.",
    results: [
      { label: "Tracking error, real office", value: "1.56 cm" },
      { label: "Worst error in the apartment, learned vs classic features", value: "17.2 vs 76.8 cm" },
      { label: "Navigation goal accuracy", value: "~10–12 cm" },
      { label: "Apartment trajectory mapped", value: "86 m" },
    ],
    lessons: [
      "Learned features never lost the map, even where classic tracking broke apart, at about 30× the compute.",
      "On well-textured scenes classic features stay more precise and much faster: pick per scene.",
      "A digital twin with exact ground truth is the best test rig you can build.",
    ],
    usp: [
      "From a plain camera to a robot that drives itself: mapping, the digital twin, the navigation map and route planning, all built and connected.",
      "Measured, not eyeballed: every run is scored against exact ground truth, down to the centimetre.",
      "Robust where classic tracking breaks: in the hardest runs the learned-feature pipeline never lost the map.",
    ],
    industries: [
      { name: "Service & delivery robots", use: "Map a building once, then navigate it every day without markers or beacons." },
      { name: "Warehouses & factories", use: "Maps and routes for mobile robots that adapt when the layout changes." },
      { name: "Facilities & real estate", use: "3D digital twins of real rooms and buildings from ordinary camera footage." },
      { name: "Simulation & testing", use: "Test robots safely in a faithful twin before they meet the real thing." },
    ],
    featured: true,
  },


  {
    slug: "edge-ai-quantization",
    repo: "https://github.com/thisz-akj/INT8_DETECTION_UNDER_DEGRADATION",
    index: "08",
    title: "Edge AI Acceleration: Quantization and Compilation for Robot Hardware",
    client: "Edge AI · Robotics",
    tags: ["Edge AI", "Model Optimisation", "Robotics"],
    year: "2026",
    summary:
      "Taking vision models from the lab onto the robot: choosing the right precision for each job, compiling for the target accelerator, and running full ML pipelines on edge hardware with the speed–accuracy trade-off measured.",
    cover: "/work/cv-edge-module.webp",
    gallery: ["/work/cv-edge-module.webp", "/work/cv-edge-module-2.webp"],
    clip: "/video/cv-edge-module.mp4",
    problem:
      "Models trained on big GPUs are too slow and too large for the computer on a robot or a vehicle. Shrinking them can cost accuracy, often worst on the blurred, dark or compressed images robots actually see, and nobody notices until it's in the field.",
    contribution:
      "Quantise and compile perception models for edge accelerators and industrial edge computers, at FP32, FP16, BF16 or INT8 depending on what each job needs, and run complete perception pipelines (camera, detection, tracking, planning) on robots in the field. A controlled study measured what INT8 costs a detector on clean and degraded images, including the fix that didn't fully work.",
    results: [
      { label: "INT8 speed-up on one CPU thread", value: "1.94×" },
      { label: "Pose model on an edge accelerator", value: "2× faster" },
      { label: "Precisions deployed", value: "FP32 · FP16 · BF16 · INT8" },
    ],
    lessons: [
      "The right precision is a requirement, not a habit: measure speed and accuracy on the target device, then choose.",
      "Report the fix that didn't fully work too. Honest negative results save clients money.",
    ],
    usp: [
      "The right precision for each job, from full to 8-bit, chosen from measured trade-offs rather than defaults.",
      "Runs on the real hardware: edge accelerators and industrial computers on robots, not just a desktop GPU.",
      "Honest numbers, including the accuracy lost on blurred, dark or compressed images.",
    ],
    industries: [
      { name: "Robotics & AMRs", use: "Perception that runs on the robot itself, with no round trip to the cloud." },
      { name: "Automotive", use: "Driver assistance on the vehicle's own computer, inside its power budget." },
      { name: "Smart cameras & IoT", use: "Detection on low-cost devices right where the camera is." },
      { name: "Industrial inspection", use: "Real-time vision on line-side hardware, fast enough for the line speed." },
    ],
    featured: true,
  },



];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
