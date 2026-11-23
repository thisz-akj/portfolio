import type { Project } from "@/types/content";

/** Facts below come from the project READMEs in the owner's repositories. */
export const projects: Project[] = [
  {
    slug: "visual-slam-to-navigation",
    index: "01",
    title: "From Visual SLAM to a Robot That Drives Itself",
    client: "visual_Slam2Nav",
    tags: ["Robotics", "Visual SLAM", "Digital Twin"],
    year: "2026",
    summary:
      "Two visual SLAM pipelines, one digital twin of a real apartment, and a robot that navigates inside it — on a CPU-only laptop.",
    cover: "/work/gz_hd_oblique.webp",
    gallery: ["/work/gz_hd_oblique.webp", "/work/orb_vs_splg_twin.webp", "/work/cmp_traj_fr3_office.webp", "/work/nav_route.webp"],
    problem:
      "Can learned features (SuperPoint + LightGlue) replace hand-crafted ORB features in visual SLAM — and what do they cost on a CPU?",
    contribution:
      "Built the full chain: RGB-D video → SLAM → dense TSDF map → Gazebo twin → SLAM evaluation against perfect ground truth → autonomous navigation. Wrote the second SLAM pipeline (splg_slam) from scratch.",
    approach: [
      "Pipeline 1: ORB-SLAM3 (C++) with DBoW2 loop closure.",
      "Pipeline 2: SuperPoint keypoints + LightGlue matching, LightGlue-verified loops and an SE(3) pose graph.",
      "Both write identical outputs, so mapping, twin export and navigation are shared and the comparison isolates the features.",
      "Navigation: A* planning, pure-pursuit control and lidar replanning inside the twin.",
    ],
    results: [
      { label: "ATE, real office (fr3)", value: "1.56 cm" },
      { label: "Hardest twin run, learned features", value: "0 breaks · 100%" },
      { label: "Apartment worst error, learned vs ORB", value: "17.2 vs 76.8 cm" },
      { label: "Navigation goal accuracy", value: "~10–12 cm" },
    ],
    lessons: [
      "Learned features never lost the map, even where ORB-SLAM3 broke apart — at roughly 30× the CPU compute.",
      "On well-textured scenes ORB-SLAM3 stays the more precise and much faster choice.",
    ],
    stack: ["Python", "C++", "ORB-SLAM3", "SuperPoint", "LightGlue", "Open3D", "Gazebo", "ROS 2"],
    featured: true,
  },
  {
    slug: "targetless-camera-lidar-calibration",
    index: "02",
    title: "Targetless Camera–LiDAR Calibration",
    client: "Visual LiDAR Calibration Tool",
    tags: ["Perception", "Calibration", "Tooling"],
    year: "2026",
    summary:
      "Estimate the rigid transform between a camera and a LiDAR without a calibration board — with a GUI anyone can run.",
    cover: "/work/04_calibrate_viewer_overlay.webp",
    gallery: ["/work/04_calibrate_viewer_overlay.webp", "/work/03_preprocess_viewer_pointcloud.webp", "/work/01_main_window_idle.webp"],
    problem:
      "Sensor fusion breaks when camera and LiDAR disagree about where things are. Board-based calibration is slow and impractical in the field.",
    contribution:
      "Packaged a targetless calibration pipeline into a usable tool: a C++ engine, a ROS 2 package, a desktop GUI with one button per stage and a headless CLI for batch runs.",
    approach: [
      "Learned feature matching (SuperGlue) between camera images and LiDAR intensity projections.",
      "Geometric optimisation with GTSAM, followed by statistical refinement.",
      "Containerised ROS 2 (Jazzy) build for reproducibility.",
    ],
    results: [
      { label: "Pipeline stages", value: "4, end to end" },
      { label: "Interfaces", value: "GUI + headless CLI" },
      { label: "Calibration target", value: "None needed" },
    ],
    lessons: ["The best algorithm is useless if only its author can run it — the GUI mattered as much as the optimiser."],
    stack: ["C++", "Python", "ROS 2", "GTSAM", "SuperGlue", "Docker", "Tkinter"],
    featured: true,
  },
  {
    slug: "int8-detection-under-degradation",
    index: "03",
    title: "What Does INT8 Really Cost a Detector?",
    client: "INT8 Detection Study",
    tags: ["Evaluation", "Quantization", "Computer Vision"],
    year: "2026",
    summary:
      "A three-part study of YOLOv8n on CPU: quantize to INT8, degrade the inputs, then make one targeted fix and report honestly.",
    cover: "/work/task2_degradation_map50.webp",
    gallery: ["/work/task2_degradation_map50.webp", "/work/degradation_examples.webp", "/work/task2_relative_gap.webp"],
    problem:
      "Quantization makes models faster, but does the accuracy cost grow when real-world images are blurred, dark or compressed?",
    contribution:
      "Designed the evaluation: a fixed 500-image COCO subset (2,353 annotations), single-threaded pinned latency, four degradations and a controlled intervention.",
    approach: [
      "FP32 baseline exported to a fixed 640×640 ONNX graph, scored with pycocotools.",
      "INT8 quantization; diagnosed why the first S8S8 attempt was slower than FP32 and fixed the kernel path.",
      "Built four degraded eval sets and the 5×2 mAP@0.5 table.",
      "Recalibrated quantization on motion-blurred images as the one targeted fix.",
    ],
    results: [
      { label: "FP32 mAP@0.5", value: "0.586" },
      { label: "INT8 speed-up (1 thread)", value: "1.94×" },
      { label: "Latency FP32 → INT8", value: "134.9 → 69.7 ms" },
    ],
    lessons: ["Report the fix that didn't fully work, too. Honest negative results save clients money."],
    stack: ["YOLOv8n", "ONNX Runtime", "pycocotools", "Python"],
    featured: true,
  },
  {
    slug: "learned-vs-handcrafted-features",
    index: "04",
    title: "Learned vs Hand-Crafted Features, Head to Head",
    client: "visual_Slam2Nav",
    tags: ["Research", "Benchmark"],
    year: "2026",
    summary: "Same data, same back end, different eyes: an apples-to-apples comparison of ORB and SuperPoint + LightGlue.",
    cover: "/work/orb_vs_splg_twin.webp",
    gallery: ["/work/orb_vs_splg_twin.webp", "/work/cmp_summary.webp", "/work/orb_features.webp"],
    problem: "Most feature comparisons change several things at once. This one changes only the front end.",
    contribution: "Designed the controlled comparison on real video and on Gazebo twin runs scored against exact ground truth.",
    approach: ["Identical keyframe design and output format for both pipelines.", "SE(3)-aligned ATE on every run."],
    results: [
      { label: "HD twin run C, learned", value: "1.19 cm" },
      { label: "Map surface error", value: "5.55 vs 5.63 cm" },
    ],
    lessons: ["Robustness and precision are different axes; pick per scene."],
    stack: ["Python", "SuperPoint", "LightGlue", "ORB-SLAM3"],
    featured: true,
  },
  {
    slug: "apartment-digital-twin",
    index: "05",
    title: "A Digital Twin of a Real Apartment",
    client: "visual_Slam2Nav",
    tags: ["3D Reconstruction", "Simulation"],
    year: "2026",
    summary: "An RGB-D scan fused into a TSDF mesh, levelled, squared and exported into Gazebo as a drivable world.",
    cover: "/work/gz_splg_top.webp",
    gallery: ["/work/gz_splg_top.webp", "/work/apt0_map_topdown.webp"],
    problem: "Testing navigation on real hardware is slow. A faithful twin makes it repeatable.",
    contribution: "Built the map-to-world export: RANSAC floor levelling, wall alignment and mesh export.",
    approach: ["TSDF fusion + marching cubes", "RANSAC floor and gravity estimation", "Gazebo world export"],
    results: [{ label: "Apartment trajectory", value: "86 m" }],
    lessons: ["A simulator with exact ground truth is the best evaluation tool you can build."],
    stack: ["Open3D", "Gazebo", "Python"],
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
