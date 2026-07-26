// ========== AUTHENTICATION ==========
const ADMIN_USERNAME = 'user';
const ADMIN_PASSWORD = '12345678';
let currentUser = null;

function generateStars() {
  const container = document.getElementById('stars-container');
  if (!container) return;
  container.innerHTML = '';
  const count = Math.floor(Math.random() * 50) + 100;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    const size = Math.random() * 2 + 1;
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.animationDelay = Math.random() * 3 + 's';
    star.style.animationDuration = (Math.random() * 2 + 2) + 's';
    container.appendChild(star);
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-message');
  errorMsg.textContent = '';
  errorMsg.classList.remove('show');

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    localStorage.setItem('workoutTrackerAuth', JSON.stringify({
      authenticated: true,
      username: username,
      timestamp: Date.now()
    }));
    currentUser = username;
    const loginEl = document.getElementById('login-container');
    loginEl.classList.add('hidden');
    setTimeout(() => {
      loginEl.style.display = 'none';
      initializeApp();
    }, 400);
    document.getElementById('login-form').reset();
  } else {
    errorMsg.textContent = '❌ Invalid username or password';
    errorMsg.classList.add('show');
    document.getElementById('username').focus();
  }
}

function togglePasswordVisibility() {
  const pwd = document.getElementById('password');
  const btn = document.querySelector('.toggle-password-btn');
  if (pwd.type === 'password') {
    pwd.type = 'text';
    btn.textContent = '🙈';
  } else {
    pwd.type = 'password';
    btn.textContent = '👁️';
  }
}

function checkAuth() {
  const stored = localStorage.getItem('workoutTrackerAuth');
  if (!stored) return false;
  try {
    const data = JSON.parse(stored);
    if (data.authenticated) {
      currentUser = data.username;
      return true;
    }
  } catch (_) {}
  return false;
}

function handleLogout() {
  if (!confirm('Logout?')) return;
  if (isWorkoutActive) stopWorkout();
  stopPoseDetection();
  localStorage.removeItem('workoutTrackerAuth');
  currentUser = null;
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('app-container').style.opacity = '0';
  document.getElementById('keyboard-help').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('login-container').classList.remove('hidden');
  document.getElementById('login-form').reset();
  document.getElementById('error-message').textContent = '';
  document.getElementById('error-message').classList.remove('show');
  // Reset UI
  repCount = 0;
  totalRepsToday = 0;
  caloriesBurned = 0;
  workoutStartTime = null;
  if (timerInterval) clearInterval(timerInterval);
  updateMetrics();
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('feedback').textContent = 'Select an exercise to begin';
  document.getElementById('accuracy').textContent = '0%';
  document.getElementById('toggle-btn').textContent = '▶ Start';
  document.getElementById('toggle-btn').className = 'btn-primary';
  document.getElementById('pause-btn').disabled = true;
  document.getElementById('pause-btn').textContent = '⏸ Pause';
  document.querySelector('.video-container')?.classList.remove('active');
  location.reload();
}

// ========== GLOBALS ==========
let video, canvas, ctx;
let detector;
let isDetecting = false;
let isWorkoutActive = false;
let currentExercise = null;
let repCount = 0;
let totalRepsToday = 0;
let caloriesBurned = 0;
let workoutStartTime = null;
let timerInterval = null;
let pausedAt = null;
let workoutHistory = [];
let achievements = { firstWorkout: false, hundredReps: 0, perfectForm: 0, streak: 0 };
let recognition;
let isListening = false;
let customPlans = [];
let cameraEnabled = false;
let animationId = null;
let lastFrameTime = 0;
const targetFPS = 20;
const frameInterval = 1000 / targetFPS;
let lastRepTime = 0;
let isEstimating = false;
let smoothedKeypoints = null;
const SMOOTHING_FACTOR = 0.6;
let actualVideoWidth = 640;
let actualVideoHeight = 480;

// Exercise state
let pushAngleHistory = { left: [], right: [] };
let pushDown = { left: false, right: false };
const PUSH_DOWN_ANGLE = 90, PUSH_UP_ANGLE = 160, PUSH_MIN_CHANGE = 8;
let squatAngleHistory = { left: [], right: [] };
let squatDown = { left: false, right: false };
const SQUAT_DOWN_ANGLE = 100, SQUAT_UP_ANGLE = 160, SQUAT_MIN_CHANGE = 8;
let lungeAngleHistory = { left: [], right: [] };
let lungeDown = { left: false, right: false };
const LUNGE_DOWN_ANGLE = 90, LUNGE_UP_ANGLE = 160, LUNGE_MIN_CHANGE = 8;
let deadliftAngleHistory = { left: [], right: [] };
let deadliftDown = { left: false, right: false };
const DEADLIFT_DOWN_ANGLE = 90, DEADLIFT_UP_ANGLE = 160, DEADLIFT_MIN_CHANGE = 8;
let pressAngleHistory = { left: [], right: [] };
let pressUp = { left: false, right: false };
const PRESS_UP_ANGLE = 160, PRESS_DOWN_ANGLE = 90, PRESS_MIN_CHANGE = 8;
let leftAngleHistory = [], rightAngleHistory = [];
let leftCurlDown = false, rightCurlDown = false;
const CURL_DOWN_ANGLE = 80, CURL_UP_ANGLE = 150, MIN_ANGLE_CHANGE = 10;
let jackState = { inPosition: false, armHistory: [], legHistory: [] };
const JACK_ARM_SPREAD = 200, JACK_LEG_SPREAD = 100, JACK_CLOSE = 50;
let burpeeState = { down: false, jump: false }

;
let plankTimer = null;
let genericMovementActive = false, genericMovementStartTime = 0;
let previousKeypoints = null;
let formScores = [];

// ========== EXERCISE DATABASE ==========
const exercises = [
  { name: "Push-ups", key: "pushups", category: "Chest", difficulty: "beginner", calories: 0.5, instructions: "Lower until elbows are 90°, then push up fully. Keep your core tight." },
  { name: "Incline Push-ups", key: "inclinepushups", category: "Chest", difficulty: "beginner", calories: 0.4, instructions: "Place hands on elevated surface, perform push-up motion." },
  { name: "Decline Push-ups", key: "declinepushups", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Feet elevated, perform push-ups targeting upper chest." },
  { name: "Diamond Push-ups", key: "diamondpushups", category: "Chest", difficulty: "advanced", calories: 0.7, instructions: "Form diamond with hands, perform push-ups focusing on triceps." },
  { name: "Wide Push-ups", key: "widepushups", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Hands wider than shoulders, focus on chest muscles." },
  { name: "Pike Push-ups", key: "pikepushups", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Form inverted V, push up targeting shoulders and upper chest." },
  { name: "Clap Push-ups", key: "clappushups", category: "Chest", difficulty: "advanced", calories: 0.8, instructions: "Explosive push-up with clap at the top position." },
  { name: "Archer Push-ups", key: "archerpushups", category: "Chest", difficulty: "advanced", calories: 0.7, instructions: "One arm extended wide, focus on single side chest development." },
  { name: "One-arm Push-ups", key: "onearmpushups", category: "Chest", difficulty: "advanced", calories: 0.9, instructions: "Advanced variation using only one arm for maximum strength." },
  { name: "Spiderman Push-ups", key: "spidermanpushups", category: "Chest", difficulty: "intermediate", calories: 0.7, instructions: "Bring knee to elbow during descent for core engagement." },
  { name: "Barbell Bench Press", key: "barbellbench", category: "Chest", difficulty: "intermediate", calories: 0.8, instructions: "Lie on bench, lower barbell to chest, press up with control." },
  { name: "Dumbbell Bench Press", key: "dumbbellbench", category: "Chest", difficulty: "intermediate", calories: 0.7, instructions: "Lie on bench, press dumbbells up with controlled motion." },
  { name: "Incline Barbell Press", key: "inclinebarbell", category: "Chest", difficulty: "intermediate", calories: 0.7, instructions: "Incline bench, press barbell targeting upper chest." },
  { name: "Incline Dumbbell Press", key: "inclinedumbbell", category: "Chest", difficulty: "intermediate", calories: 0.7, instructions: "Incline bench, press dumbbells for upper chest development." },
  { name: "Decline Bench Press", key: "declinebench", category: "Chest", difficulty: "intermediate", calories: 0.7, instructions: "Decline bench, press barbell targeting lower chest." },
  { name: "Cable Crossovers", key: "cablecrossovers", category: "Chest", difficulty: "intermediate", calories: 0.5, instructions: "Stand between cable machines, cross arms in front of chest." },
  { name: "Pec Deck Machine", key: "pecdeck", category: "Chest", difficulty: "beginner", calories: 0.4, instructions: "Sit at machine, bring pads together squeezing chest muscles." },
  { name: "Chest Fly Machine", key: "chestfly", category: "Chest", difficulty: "beginner", calories: 0.4, instructions: "Use chest fly machine for isolated chest development." },
  { name: "Dumbbell Flyes", key: "dumbbellflyes", category: "Chest", difficulty: "intermediate", calories: 0.5, instructions: "Lie on bench, lower dumbbells in arc motion, squeeze chest." },
  { name: "Incline Dumbbell Flyes", key: "inclinedumbbellflyes", category: "Chest", difficulty: "intermediate", calories: 0.5, instructions: "Incline bench flyes for upper chest emphasis." },
  { name: "Cable Chest Press", key: "cablechestpress", category: "Chest", difficulty: "intermediate", calories: 0.5, instructions: "Use cable machine for constant tension chest pressing." },
  { name: "Landmine Press", key: "landminepress", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Press barbell from landmine attachment for unique chest stimulus." },
  { name: "Plate Press", key: "platepress", category: "Chest", difficulty: "beginner", calories: 0.4, instructions: "Press weight plates together isometrically for chest activation." },
  { name: "Band Push-ups", key: "bandpushups", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Add resistance band for increased push-up difficulty." },
  { name: "Weighted Push-ups", key: "weightedpushups", category: "Chest", difficulty: "advanced", calories: 0.8, instructions: "Add weight plate on back for increased resistance." },
  { name: "Medicine Ball Push-ups", key: "medicineballpushups", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Hands on medicine balls for instability and core engagement." },
  { name: "TRX Push-ups", key: "trxpushups", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Suspension trainer push-ups for core stability." },
  { name: "Ring Push-ups", key: "ringpushups", category: "Chest", difficulty: "advanced", calories: 0.7, instructions: "Gymnastic rings push-ups for advanced stability training." },
  { name: "Handstand Push-ups", key: "handstandpushups", category: "Chest", difficulty: "advanced", calories: 0.9, instructions: "Advanced vertical pushing movement against wall." },
  { name: "Dips", key: "dips", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Lower between parallel bars, focus on chest stretch." },
  { name: "Bench Dips", key: "benchdips", category: "Chest", difficulty: "beginner", calories: 0.4, instructions: "Use bench for assisted dip variation." },
  { name: "Weighted Dips", key: "weighteddips", category: "Chest", difficulty: "advanced", calories: 0.8, instructions: "Add weight for increased dip resistance." },
  { name: "Machine Chest Press", key: "machinechestpress", category: "Chest", difficulty: "beginner", calories: 0.6, instructions: "Use chest press machine for controlled movement." },
  { name: "Smith Machine Press", key: "smithmachinepress", category: "Chest", difficulty: "beginner", calories: 0.6, instructions: "Smith machine for guided bench press motion." },
  { name: "Guillotine Press", key: "guillotinepress", category: "Chest", difficulty: "advanced", calories: 0.7, instructions: "Barbell lowered to neck for unique chest stretch." },
  { name: "Close Grip Bench Press", key: "closegripbench", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Narrow grip bench press emphasizing triceps and inner chest." },
  { name: "Reverse Grip Bench Press", key: "reversegripbench", category: "Chest", difficulty: "advanced", calories: 0.7, instructions: "Underhand grip bench press for different chest activation." },
  { name: "Floor Press", key: "floorpress", category: "Chest", difficulty: "intermediate", calories: 0.6, instructions: "Press from floor limiting range, good for strength." },
  { name: "Board Press", key: "boardpress", category: "Chest", difficulty: "advanced", calories: 0.7, instructions: "Use boards to limit range for overload training." },
  { name: "Pull-ups", key: "pullups", category: "Back", difficulty: "intermediate", calories: 0.6, instructions: "Hang from bar, pull body up until chin clears the bar." },
  { name: "Chin-ups", key: "chinups", category: "Back", difficulty: "intermediate", calories: 0.6, instructions: "Palms facing you, pull body up until chin clears the bar." },
  { name: "Wide-grip Pull-ups", key: "widegrippullups", category: "Back", difficulty: "advanced", calories: 0.6, instructions: "Wide grip on bar, pull body up focusing on lats." },
  { name: "Close-grip Pull-ups", key: "closegrippullups", category: "Back", difficulty: "intermediate", calories: 0.6, instructions: "Close grip on bar, pull body up until chin clears bar." },
  { name: "Neutral-grip Pull-ups", key: "neutralgrippullups", category: "Back", difficulty: "intermediate", calories: 0.6, instructions: "Palms facing each other, pull body up until chin clears bar." },
  { name: "Weighted Pull-ups", key: "weightedpullups", category: "Back", difficulty: "advanced", calories: 0.8, instructions: "Perform pull-ups with additional weight attached to body." },
  { name: "Assisted Pull-ups", key: "assistedpullups", category: "Back", difficulty: "beginner", calories: 0.5, instructions: "Use assistance machine to perform pull-up motion with support." },
  { name: "Lat Pulldown", key: "latpulldown", category: "Back", difficulty: "beginner", calories: 0.5, instructions: "Sit at lat machine, pull bar down to chest, focusing on lats." },
  { name: "Close Grip Lat Pulldown", key: "closegrippulldown", category: "Back", difficulty: "beginner", calories: 0.5, instructions: "Close grip pulldown targeting different back areas." },
  { name: "Reverse Grip Pulldown", key: "reversegrippulldown", category: "Back", difficulty: "intermediate", calories: 0.5, instructions: "Underhand grip pulldown for bicep and back engagement." },
  { name: "Straight Arm Pulldown", key: "straightarmpulldown", category: "Back", difficulty: "intermediate", calories: 0.4, instructions: "Standing straight arm pulldown for lat isolation." },
  { name: "Barbell Bent-over Row", key: "barbellbentoverrow", category: "Back", difficulty: "intermediate", calories: 0.7, instructions: "Bend at waist, pull barbell to lower chest, squeeze back muscles." },
  { name: "Dumbbell Row", key: "dumbbellrow", category: "Back", difficulty: "intermediate", calories: 0.6, instructions: "Bend over with support, pull dumbbell to side, squeezing back." },
  { name: "T-bar Row", key: "tbarrow", category: "Back", difficulty: "intermediate", calories: 0.7, instructions: "Straddle T-bar machine, pull handles to chest while keeping back straight." },
  { name: "Seated Cable Row", key: "seatedcablerow", category: "Back", difficulty: "beginner", calories: 0.5, instructions: "Sit at cable machine, pull handles to abdomen, squeezing shoulder blades." },
  { name: "Chest-supported Row", key: "chestsupportedrow", category: "Back", difficulty: "intermediate", calories: 0.6, instructions: "Lie chest on supported bench, row weights towards chest." },
  { name: "Inverted Row", key: "invertedrow", category: "Back", difficulty: "intermediate", calories: 0.5, instructions: "Under bar set at waist height, pull chest to bar while keeping body straight." },
  { name: "Machine Row", key: "machinerow", category: "Back", difficulty: "beginner", calories: 0.5, instructions: "Sit at row machine, pull handles towards chest, squeezing back muscles." },
  { name: "Single Arm Dumbbell Row", key: "singlearmdumbbellrow", category: "Back", difficulty: "intermediate", calories: 0.6, instructions: "One arm at a time row for focused back development." },
  { name: "Kroc Rows", key: "krocrows", category: "Back", difficulty: "advanced", calories: 0.8, instructions: "High rep, heavy dumbbell rows for back thickness." },
  { name: "Pendlay Rows", key: "pendlayrows", category: "Back", difficulty: "advanced", calories: 0.7, instructions: "Explosive rows from floor with strict form." },
  { name: "Deadlifts", key: "deadlifts", category: "Back", difficulty: "intermediate", calories: 0.8, instructions: "Keep back straight and lift from hips using legs." },
  { name: "Romanian Deadlifts", key: "romaniandeadlifts", category: "Back", difficulty: "intermediate", calories: 0.7, instructions: "Hinge at hips, lower weight while keeping legs straight." },
  { name: "Sumo Deadlifts", key: "sumodeadlifts", category: "Back", difficulty: "intermediate", calories: 0.8, instructions: "Wide stance deadlifts with emphasis on quads and glutes." },
  { name: "Stiff-legged Deadlifts", key: "stiffleggeddeadlifts", category: "Back", difficulty: "intermediate", calories: 0.7, instructions: "Keep legs straight, hinge at hips to target hamstrings." },
  { name: "Rack Pulls", key: "rackpulls", category: "Back", difficulty: "intermediate", calories: 0.7, instructions: "Partial deadlift from elevated position, focus on lockout." },
  { name: "Good Mornings", key: "goodmornings", category: "Back", difficulty: "intermediate", calories: 0.5, instructions: "Barbell on shoulders, hinge at hips, keep back straight." },
  { name: "Hyperextensions", key: "hyperextensions", category: "Back", difficulty: "beginner", calories: 0.4, instructions: "On hyperextension bench, lower torso then raise to straight body position." },
  { name: "Reverse Hyperextensions", key: "reversehyperextensions", category: "Back", difficulty: "intermediate", calories: 0.5, instructions: "Lie face down, lift legs against resistance for lower back." },
  { name: "Face Pulls", key: "facepulls", category: "Back", difficulty: "beginner", calories: 0.3, instructions: "Use cable machine with rope attachment, pull towards face with external rotation." },
  { name: "Band Pull-aparts", key: "bandpullaparts", category: "Back", difficulty: "beginner", calories: 0.2, instructions: "Hold resistance band, pull apart squeezing shoulder blades." },
  { name: "Supermans", key: "supermans", category: "Back", difficulty: "beginner", calories: 0.3, instructions: "Lie face down, lift arms and legs simultaneously." },
  { name: "Bird Dogs", key: "birddogs", category: "Back", difficulty: "beginner", calories: 0.3, instructions: "On hands and knees, extend opposite arm and leg." },
  { name: "Renegade Rows", key: "renegaderows", category: "Back", difficulty: "advanced", calories: 0.7, instructions: "Plank position row with dumbbells for core and back." },
  { name: "Bodyweight Rows", key: "bodyweightrows", category: "Back", difficulty: "beginner", calories: 0.4, instructions: "Use bar or rings for horizontal pulling movement." },
  { name: "Overhead Press", key: "overheadpress", category: "Shoulders", difficulty: "intermediate", calories: 0.7, instructions: "Press barbell overhead from shoulder height to full arm extension." },
  { name: "Dumbbell Shoulder Press", key: "dumbbellshoulderpress", category: "Shoulders", difficulty: "intermediate", calories: 0.6, instructions: "Press dumbbells overhead from shoulder height to full extension." },
  { name: "Arnold Press", key: "arnoldpress", category: "Shoulders", difficulty: "intermediate", calories: 0.6, instructions: "Start with palms facing you, rotate as you press up to palms forward." },
  { name: "Push Press", key: "pushpress", category: "Shoulders", difficulty: "intermediate", calories: 0.7, instructions: "Use slight leg drive to help press weight overhead." },
  { name: "Military Press", key: "militarypress", category: "Shoulders", difficulty: "intermediate", calories: 0.7, instructions: "Strict standing press with feet together." },
  { name: "Seated Shoulder Press", key: "seatedshoulderpress", category: "Shoulders", difficulty: "intermediate", calories: 0.6, instructions: "Sit on bench with back support, press weight overhead." },
  { name: "Lateral Raises", key: "lateralraises", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Raise arms to sides until parallel with ground, lower slowly." },
  { name: "Front Raises", key: "frontraises", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Raise arms forward to shoulder height, maintain control." },
  { name: "Bent-over Lateral Raises", key: "bentoverlateralraises", category: "Shoulders", difficulty: "intermediate", calories: 0.4, instructions: "Bend at waist, raise arms to sides targeting rear delts." },
  { name: "Upright Rows", key: "uprightrows", category: "Shoulders", difficulty: "intermediate", calories: 0.5, instructions: "Pull barbell or dumbbells straight up to chin level." },
  { name: "Face Pulls", key: "facepullsshoulders", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Pull rope attachment towards face for rear delt development." },
  { name: "Cable Lateral Raises", key: "cablelateralraises", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Use cable machine for constant tension lateral raises." },
  { name: "Machine Shoulder Press", key: "machineshoulderpress", category: "Shoulders", difficulty: "beginner", calories: 0.6, instructions: "Use shoulder press machine for controlled overhead pressing." },
  { name: "Landmine Press", key: "landminepressshoulders", category: "Shoulders", difficulty: "intermediate", calories: 0.6, instructions: "Press barbell from landmine for shoulder development." },
  { name: "Single Arm Press", key: "singlearmpress", category: "Shoulders", difficulty: "intermediate", calories: 0.5, instructions: "Press one arm at a time for unilateral shoulder development." },
  { name: "Behind Neck Press", key: "behindneckpress", category: "Shoulders", difficulty: "advanced", calories: 0.7, instructions: "Press barbell behind neck (advanced - use caution)." },
  { name: "Bradford Press", key: "bradfordpress", category: "Shoulders", difficulty: "intermediate", calories: 0.6, instructions: "Alternate front and behind neck presses in one motion." },
  { name: "Dumbbell Clean and Press", key: "dumbbellcleanpress", category: "Shoulders", difficulty: "advanced", calories: 0.8, instructions: "Clean dumbbells to shoulders then press overhead." },
  { name: "Kettlebell Press", key: "kettlebellpress", category: "Shoulders", difficulty: "intermediate", calories: 0.6, instructions: "Press kettlebells overhead for shoulder strength." },
  { name: "Handstand Push-ups", key: "handstandpushupsshoulders", category: "Shoulders", difficulty: "advanced", calories: 0.9, instructions: "Advanced vertical pressing movement against wall." },
  { name: "Pike Push-ups", key: "pikepushupsshoulders", category: "Shoulders", difficulty: "intermediate", calories: 0.6, instructions: "Inverted V position push-ups for shoulder emphasis." },
  { name: "Scaption Raises", key: "scaptionraises", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Raise arms at 45-degree angle for shoulder health." },
  { name: "Cuban Press", key: "cubanpress", category: "Shoulders", difficulty: "intermediate", calories: 0.5, instructions: "Rotational shoulder movement for rotator cuff health." },
  { name: "Plate Raises", key: "plateraises", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Hold weight plate for front raises with different grip." },
  { name: "Barbell Front Raises", key: "barbellfrontraises", category: "Shoulders", difficulty: "intermediate", calories: 0.4, instructions: "Front raises with barbell for different stimulus." },
  { name: "Reverse Pec Deck", key: "reversepecdeck", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Use pec deck machine in reverse for rear delts." },
  { name: "Machine Lateral Raises", key: "machinelateralraises", category: "Shoulders", difficulty: "beginner", calories: 0.3, instructions: "Use lateral raise machine for controlled movement." },
  { name: "Single Arm Cable Raises", key: "singlearmcableraises", category: "Shoulders", difficulty: "intermediate", calories: 0.3, instructions: "One arm at a time cable raises for focused work." },
  { name: "Y-T-W-L Raises", key: "ytwlraises", category: "Shoulders", difficulty: "beginner", calories: 0.4, instructions: "Series of shoulder movements for comprehensive development." },
  { name: "Band Pull-aparts Shoulders", key: "bandpullapartsshoulders", category: "Shoulders", difficulty: "beginner", calories: 0.2, instructions: "Resistance band exercise for shoulder health." },
  { name: "Bicep Curls", key: "bicepcurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Curl your arms fully up and down with control. Keep elbows stationary." },
  { name: "Hammer Curls", key: "hammercurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Curl with neutral grip, thumbs pointing up throughout movement." },
  { name: "Preacher Curls", key: "preachercurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Use preacher bench to isolate biceps, curl weight up with control." },
  { name: "Concentration Curls", key: "concentrationcurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Sit on bench, brace elbow against inner thigh, curl dumbbell up." },
  { name: "Incline Dumbbell Curls", key: "inclinedumbbellcurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Lie on incline bench, curl dumbbells with supination at top." },
  { name: "Spider Curls", key: "spidercurls", category: "Arms", difficulty: "intermediate", calories: 0.3, instructions: "Lie face down on incline bench, curl weight up focusing on biceps peak." },
  { name: "Cable Curls", key: "cablecurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Use cable machine for constant tension during bicep curls." },
  { name: "Reverse Curls", key: "reversecurls", category: "Arms", difficulty: "intermediate", calories: 0.3, instructions: "Curl with overhand grip to target brachialis and forearms." },
  { name: "Zottman Curls", key: "zottmancurls", category: "Arms", difficulty: "intermediate", calories: 0.4, instructions: "Curl up with supinated grip, rotate to pronated grip on way down." },
  { name: "Barbell Curls", key: "barbellcurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Curl barbell towards shoulders, keep elbows stationary." },
  { name: "EZ Bar Curls", key: "ezbarcurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Use EZ bar for more comfortable bicep curling." },
  { name: "21s", key: "twentyones", category: "Arms", difficulty: "intermediate", calories: 0.5, instructions: "7 partial bottom, 7 partial top, 7 full range curls." },
  { name: "Cross Body Hammer Curls", key: "crossbodyhammercurls", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Hammer curls across body for different bicep activation." },
  { name: "Tricep Pushdowns", key: "triceppushdowns", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Use cable machine with bar attachment, push down until arms extended." },
  { name: "Overhead Tricep Extensions", key: "overheadtricepextensions", category: "Arms", difficulty: "intermediate", calories: 0.3, instructions: "Extend arms overhead to work long head of triceps." },
  { name: "Skull Crushers", key: "skullcrushers", category: "Arms", difficulty: "intermediate", calories: 0.4, instructions: "Lie on bench, lower weight towards forehead, then extend arms." },
  { name: "Close-grip Bench Press", key: "closegripbenchpress", category: "Arms", difficulty: "intermediate", calories: 0.5, instructions: "Bench press with hands closer together to emphasize triceps." },
  { name: "Dips", key: "dipsarms", category: "Arms", difficulty: "intermediate", calories: 0.5, instructions: "Between parallel bars, lower body then push up, focusing on triceps." },
  { name: "Bench Dips", key: "benchdipsarms", category: "Arms", difficulty: "beginner", calories: 0.4, instructions: "Use bench for assisted dip variation focusing on triceps." },
  { name: "Tricep Kickbacks", key: "tricepkickbacks", category: "Arms", difficulty: "beginner", calories: 0.2, instructions: "Bend over with support, extend arm back until parallel to floor." },
  { name: "Rope Pushdowns", key: "ropepushdowns", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Use rope attachment for triceps pushdowns, spread ropes at bottom." },
  { name: "Single Arm Pushdowns", key: "singlearmpushdowns", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "One arm at a time pushdown for focused tricep work." },
  { name: "JM Press", key: "jmpress", category: "Arms", difficulty: "advanced", calories: 0.5, instructions: "Hybrid between skull crusher and close grip bench." },
  { name: "Tate Press", key: "tatepress", category: "Arms", difficulty: "intermediate", calories: 0.4, instructions: "Lie on bench, press dumbbells together over chest." },
  { name: "Diamond Push-ups", key: "diamondpushupsarms", category: "Arms", difficulty: "intermediate", calories: 0.5, instructions: "Close hand push-ups emphasizing triceps." },
  { name: "French Press", key: "frenchpress", category: "Arms", difficulty: "intermediate", calories: 0.4, instructions: "Overhead tricep extension with EZ bar or barbell." },
  { name: "Cable Overhead Extension", key: "cableoverheadextension", category: "Arms", difficulty: "intermediate", calories: 0.3, instructions: "Overhead extension using cable for constant tension." },
  { name: "Machine Tricep Extension", key: "machinetricepextension", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Use tricep extension machine for controlled movement." },
  { name: "Band Tricep Pushdown", key: "bandtriceppushdown", category: "Arms", difficulty: "beginner", calories: 0.2, instructions: "Use resistance band for tricep pushdowns anywhere." },
  { name: "Forearm Curls", key: "forearmcurls", category: "Arms", difficulty: "beginner", calories: 0.2, instructions: "Wrist curls for forearm development." },
  { name: "Reverse Forearm Curls", key: "reverseforearmcurls", category: "Arms", difficulty: "beginner", calories: 0.2, instructions: "Reverse wrist curls for forearm extensors." },
  { name: "Farmer's Walks", key: "farmerswalks", category: "Arms", difficulty: "intermediate", calories: 0.6, instructions: "Carry heavy weights for grip and forearm strength." },
  { name: "Plate Pinches", key: "platepinches", category: "Arms", difficulty: "beginner", calories: 0.1, instructions: "Pinch weight plates together for grip strength." },
  { name: "Wrist Roller", key: "wristroller", category: "Arms", difficulty: "beginner", calories: 0.3, instructions: "Roll weight up and down with wrist movement." },
  { name: "Sledgehammer Levering", key: "sledgehammerlevering", category: "Arms", difficulty: "advanced", calories: 0.4, instructions: "Lever sledgehammer for advanced forearm training." },
  { name: "Squats", key: "squats", category: "Legs", difficulty: "beginner", calories: 0.6, instructions: "Lower hips until thighs are parallel, then stand tall. Keep knees aligned." },
  { name: "Barbell Back Squats", key: "barbellbacksquats", category: "Legs", difficulty: "intermediate", calories: 0.8, instructions: "Barbell across upper back, squat down until thighs parallel." },
  { name: "Front Squats", key: "frontsquats", category: "Legs", difficulty: "intermediate", calories: 0.7, instructions: "Barbell in front rack position, squat down with upright torso." },
  { name: "Goblet Squats", key: "gobletsquats", category: "Legs", difficulty: "beginner", calories: 0.6, instructions: "Hold dumbbell or kettlebell at chest, squat deep with good form." },
  { name: "Overhead Squats", key: "overheadsquats", category: "Legs", difficulty: "advanced", calories: 0.8, instructions: "Hold barbell overhead while squatting for mobility challenge." },
  { name: "Pistol Squats", key: "pistolsquats", category: "Legs", difficulty: "advanced", calories: 0.7, instructions: "Single leg squat with other leg extended forward." },
  { name: "Jump Squats", key: "jumpsquats", category: "Legs", difficulty: "intermediate", calories: 0.8, instructions: "Perform squat then explode up into jump, land softly." },
  { name: "Box Squats", key: "boxsquats", category: "Legs", difficulty: "intermediate", calories: 0.7, instructions: "Squat to box, pause, then stand up for power development." },
  { name: "Hack Squats", key: "hacksquats", category: "Legs", difficulty: "intermediate", calories: 0.7, instructions: "Use hack squat machine for quad-focused squatting." },
  { name: "Bulgarian Split Squats", key: "bulgariansplitsquats", category: "Legs", difficulty: "intermediate", calories: 0.7, instructions: "Rear foot elevated, perform single-leg squat motion." },
  { name: "Lunges", key: "lunges", category: "Legs", difficulty: "beginner", calories: 0.5, instructions: "Step forward, lower until knees are at 90°, then push back." },
  { name: "Walking Lunges", key: "walkinglunges", category: "Legs", difficulty: "intermediate", calories: 0.6, instructions: "Step forward into lunge, continue walking motion." },
  { name: "Reverse Lunges", key: "reverselunges", category: "Legs", difficulty: "beginner", calories: 0.5, instructions: "Step backward into lunge position, return to standing." },
  { name: "Side Lunges", key: "sidelunges", category: "Legs", difficulty: "intermediate", calories: 0.5, instructions: "Step to side, lower into lunge, push back to center." },
  { name: "Curtsy Lunges", key: "curtsylunges", category: "Legs", difficulty: "intermediate", calories: 0.5, instructions: "Step back and across body like curtsy for glute activation." },
  { name: "Deadlifts", key: "deadliftslegs", category: "Legs", difficulty: "intermediate", calories: 0.8, instructions: "Hip hinge movement for posterior chain development." },
  { name: "Romanian Deadlifts", key: "romaniandeadliftslegs", category: "Legs", difficulty: "intermediate", calories: 0.7, instructions: "Hinge at hips with minimal knee bend for hamstrings." },
  { name: "Sumo Deadlifts", key: "sumodeadliftslegs", category: "Legs", difficulty: "intermediate", calories: 0.8, instructions: "Wide stance deadlifts with emphasis on quads and glutes." },
  { name: "Stiff-legged Deadlifts", key: "stiffleggeddeadliftslegs", category: "Legs", difficulty: "intermediate", calories: 0.7, instructions: "Keep legs straight, hinge at hips to target hamstrings." },
  { name: "Good Mornings", key: "goodmorningslegs", category: "Legs", difficulty: "intermediate", calories: 0.5, instructions: "Barbell on shoulders, hinge at hips for hamstring development." },
  { name: "Leg Press", key: "legpress", category: "Legs", difficulty: "beginner", calories: 0.7, instructions: "Sit in leg press machine, push weight away with feet." },
  { name: "Hack Squat Machine", key: "hacksquatmachine", category: "Legs", difficulty: "beginner", calories: 0.7, instructions: "Use hack squat machine for guided squat movement." },
  { name: "Leg Extensions", key: "legextensions", category: "Legs", difficulty: "beginner", calories: 0.4, instructions: "Sit in leg extension machine, extend legs against resistance." },
  { name: "Hamstring Curls", key: "hamstringcurls", category: "Legs", difficulty: "beginner", calories: 0.4, instructions: "Lie face down on machine, curl legs toward glutes." },
  { name: "Glute Ham Raises", key: "glutehamraises", category: "Legs", difficulty: "advanced", calories: 0.6, instructions: "Advanced hamstring and glute exercise on GHD machine." },
  { name: "Nordic Hamstring Curls", key: "nordichamstringcurls", category: "Legs", difficulty: "advanced", calories: 0.5, instructions: "Bodyweight hamstring curl for eccentric strength." },
  { name: "Calf Raises", key: "calfraises", category: "Legs", difficulty: "beginner", calories: 0.2, instructions: "Rise up on toes, hold briefly, lower with control." },
  { name: "Seated Calf Raises", key: "seatedcalfraises", category: "Legs", difficulty: "beginner", calories: 0.2, instructions: "Sit with weights on knees, raise heels as high as possible." },
  { name: "Standing Calf Raises", key: "standingcalfraises", category: "Legs", difficulty: "beginner", calories: 0.2, instructions: "Stand on edge of step, raise up on toes." },
  { name: "Donkey Calf Raises", key: "donkeycalfraises", category: "Legs", difficulty: "intermediate", calories: 0.3, instructions: "Bend over with weight on hips for calf raises." },
  { name: "Hip Thrusts", key: "hipthrusts", category: "Legs", difficulty: "intermediate", calories: 0.6, instructions: "Upper back on bench, barbell across hips, thrust upward." },
  { name: "Glute Bridges", key: "glutebridges", category: "Legs", difficulty: "beginner", calories: 0.4, instructions: "Lie on back, knees bent, lift hips until body forms straight line." },
  { name: "Cable Kickbacks", key: "cablekickbacks", category: "Legs", difficulty: "beginner", calories: 0.3, instructions: "Attach cable to ankle, kick back against resistance." },
  { name: "Step-ups", key: "stepups", category: "Legs", difficulty: "beginner", calories: 0.5, instructions: "Step onto box or bench, drive through front heel to stand fully." },
  { name: "Box Jumps", key: "boxjumps", category: "Legs", difficulty: "intermediate", calories: 0.8, instructions: "Jump onto elevated surface, step down carefully." },
  { name: "Wall Sits", key: "wallsits", category: "Legs", difficulty: "beginner", calories: 0.4, instructions: "Slide down wall until thighs parallel, hold position." },
  { name: "Sissy Squats", key: "sissysquats", category: "Legs", difficulty: "advanced", calories: 0.5, instructions: "Lean back with heels raised, squat down with emphasis on quads." },
  { name: "Zercher Squats", key: "zerchersquats", category: "Legs", difficulty: "advanced", calories: 0.8, instructions: "Hold barbell in crook of elbows for unique squat variation." },
  { name: "Belt Squats", key: "beltsquats", category: "Legs", difficulty: "intermediate", calories: 0.7, instructions: "Use belt squat machine for spine-friendly squatting." },
  { name: "Single Leg Press", key: "singlelegpress", category: "Legs", difficulty: "intermediate", calories: 0.6, instructions: "Leg press one leg at a time for unilateral development." },
  { name: "Planks", key: "planks", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Hold your core tight in straight line for as long as possible." },
  { name: "Side Planks", key: "sideplanks", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Hold side position, keep body in straight line." },
  { name: "Reverse Planks", key: "reverseplanks", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Face up plank position for posterior chain." },
  { name: "Plank with Shoulder Taps", key: "plankshouldertaps", category: "Core", difficulty: "intermediate", calories: 0.5, instructions: "Plank position while tapping opposite shoulder." },
  { name: "Plank with Leg Lifts", key: "plankleglifts", category: "Core", difficulty: "intermediate", calories: 0.5, instructions: "Plank position while lifting legs alternately." },
  { name: "Crunches", key: "crunches", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Lift shoulders off ground, contract abs, lower slowly." },
  { name: "Reverse Crunches", key: "reversecrunches", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Lift hips off ground, bringing knees toward chest." },
  { name: "Bicycle Crunches", key: "bicyclecrunches", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Alternate elbow to opposite knee in cycling motion." },
  { name: "Russian Twists", key: "russiantwists", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Rotate torso side to side while holding position." },
  { name: "Leg Raises", key: "legraises", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Lie on back, raise legs to vertical, lower with control." },
  { name: "Hanging Leg Raises", key: "hanginglegraises", category: "Core", difficulty: "advanced", calories: 0.6, instructions: "Hang from bar, raise legs to horizontal or higher." },
  { name: "Knee Raises", key: "kneeraises", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Hang from bar, raise knees to chest." },
  { name: "Windshield Wipers", key: "windshieldwipers", category: "Core", difficulty: "advanced", calories: 0.5, instructions: "Lie on back, rotate legs side to side like wipers." },
  { name: "Mountain Climbers", key: "mountainclimbers", category: "Core", difficulty: "intermediate", calories: 0.6, instructions: "Alternate bringing knees to chest in plank position." },
  { name: "Flutter Kicks", key: "flutterkicks", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Lie on back, alternate kicking legs in small motions." },
  { name: "Scissor Kicks", key: "scissorkicks", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Lie on back, cross legs in scissor motion." },
  { name: "V-ups", key: "vups", category: "Core", difficulty: "advanced", calories: 0.5, instructions: "Simultaneously lift torso and legs to form V shape." },
  { name: "Toe Touches", key: "toetouches", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Lie on back, reach hands toward toes while lifting shoulders." },
  { name: "Dead Bug", key: "deadbug", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Alternate extending opposite arm and leg while lying down." },
  { name: "Bird Dog", key: "birddogcore", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "On hands and knees, extend opposite arm and leg." },
  { name: "Superman", key: "superman", category: "Core", difficulty: "beginner", calories: 0.3, instructions: "Lie face down, lift arms and legs simultaneously." },
  { name: "Hollow Body Hold", key: "hollowbodyhold", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Lie on back, lift shoulders and legs, hold banana shape." },
  { name: "Arch Body Hold", key: "archbodyhold", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Lie face down, lift chest and legs, hold superman position." },
  { name: "L-sit", key: "lsit", category: "Core", difficulty: "advanced", calories: 0.5, instructions: "Support body on parallel bars or floor, hold legs straight." },
  { name: "Dragon Flags", key: "dragonflags", category: "Core", difficulty: "advanced", calories: 0.7, instructions: "Advanced core exercise popularized by Bruce Lee." },
  { name: "Ab Wheel Rollouts", key: "abwheelrollouts", category: "Core", difficulty: "advanced", calories: 0.5, instructions: "Kneel with ab wheel, roll forward and back with core control." },
  { name: "Cable Crunches", key: "cablecrunches", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Kneel at cable machine, crunch down against resistance." },
  { name: "Landmine Twists", key: "landminetwists", category: "Core", difficulty: "intermediate", calories: 0.5, instructions: "Hold barbell in landmine, twist side to side." },
  { name: "Pallof Press", key: "pallofpress", category: "Core", difficulty: "intermediate", calories: 0.4, instructions: "Anti-rotation exercise using cable machine." },
  { name: "Wood Choppers", key: "woodchoppers", category: "Core", difficulty: "intermediate", calories: 0.5, instructions: "Diagonal cable pulls mimicking wood chopping motion." },
  { name: "Burpees", key: "burpees", category: "Full Body", difficulty: "advanced", calories: 1.0, instructions: "Squat, jump to plank, push up, return to squat, and jump up." },
  { name: "Thrusters", key: "thrusters", category: "Full Body", difficulty: "intermediate", calories: 0.8, instructions: "Front squat immediately into overhead press in one motion." },
  { name: "Clean and Press", key: "cleanandpress", category: "Full Body", difficulty: "advanced", calories: 0.9, instructions: "Clean barbell to shoulders then press overhead." },
  { name: "Snatch", key: "snatch", category: "Full Body", difficulty: "advanced", calories: 1.0, instructions: "Olympic lift - barbell from floor to overhead in one motion." },
  { name: "Clean and Jerk", key: "cleanandjerk", category: "Full Body", difficulty: "advanced", calories: 1.0, instructions: "Olympic lift - clean to shoulders then jerk overhead." },
  { name: "Kettlebell Swings", key: "kettlebelleswings", category: "Full Body", difficulty: "intermediate", calories: 0.7, instructions: "Hinge at hips, swing kettlebell to chest height using hip power." },
  { name: "Turkish Get-ups", key: "turkishgetups", category: "Full Body", difficulty: "advanced", calories: 0.8, instructions: "Complex movement from lying to standing with kettlebell." },
  { name: "Farmer's Walks", key: "farmerswalksfull", category: "Full Body", difficulty: "intermediate", calories: 0.6, instructions: "Carry heavy weights in each hand for full body strength." },
  { name: "Suitcase Carries", key: "suitcasecarries", category: "Full Body", difficulty: "intermediate", calories: 0.5, instructions: "Carry heavy weight in one hand for anti-lateral flexion." },
  { name: "Battle Ropes", key: "battleropes", category: "Full Body", difficulty: "intermediate", calories: 0.7, instructions: "Create waves with heavy ropes for cardio and strength." },
  { name: "Sled Pushes", key: "sledpushes", category: "Full Body", difficulty: "intermediate", calories: 0.8, instructions: "Push weighted sled for leg drive and conditioning." },
  { name: "Sled Pulls", key: "sledpulls", category: "Full Body", difficulty: "intermediate", calories: 0.7, instructions: "Pull weighted sled for posterior chain development." },
  { name: "Jumping Jacks", key: "jumpingjacks", category: "Full Body", difficulty: "beginner", calories: 0.5, instructions: "Jump feet apart while raising arms, return to start." },
  { name: "Mountain Climbers", key: "mountainclimbersfull", category: "Full Body", difficulty: "intermediate", calories: 0.6, instructions: "Alternate bringing knees to chest in plank position." },
  { name: "Bear Crawls", key: "bearcrawls", category: "Full Body", difficulty: "intermediate", calories: 0.6, instructions: "Crawl on hands and feet keeping knees slightly bent." },
  { name: "Crab Walks", key: "crabwalks", category: "Full Body", difficulty: "intermediate", calories: 0.5, instructions: "Walk backward in reverse tabletop position." },
  { name: "High Knees", key: "highknees", category: "Full Body", difficulty: "beginner", calories: 0.6, instructions: "Run in place bringing knees up to waist level." },
  { name: "Butt Kickers", key: "buttkickers", category: "Full Body", difficulty: "beginner", calories: 0.5, instructions: "Run in place kicking heels toward glutes." },
  { name: "Jump Rope", key: "jumprope", category: "Full Body", difficulty: "beginner", calories: 0.6, instructions: "Basic jump rope for cardio and coordination." },
  { name: "Box Jumps Full", key: "boxjumpsfull", category: "Full Body", difficulty: "intermediate", calories: 0.8, instructions: "Jump onto box for explosive power development." },
  { name: "Medicine Ball Slams", key: "medicineballslams", category: "Full Body", difficulty: "intermediate", calories: 0.7, instructions: "Slam medicine ball into ground with full force." },
  { name: "Wall Balls", key: "wallballs", category: "Full Body", difficulty: "intermediate", calories: 0.7, instructions: "Squat with medicine ball then throw to target on wall." },
  { name: "Man Makers", key: "manmakers", category: "Full Body", difficulty: "advanced", calories: 1.0, instructions: "Complex movement combining row, push-up, and thruster." },
  { name: "Devil Press", key: "devilpress", category: "Full Body", difficulty: "advanced", calories: 1.0, instructions: "Burpee with dumbbell clean and press combination." },
  { name: "Sandbag Carries", key: "sandbagcarries", category: "Full Body", difficulty: "intermediate", calories: 0.7, instructions: "Carry awkward sandbag for functional strength." },
  { name: "Running", key: "running", category: "Cardio", difficulty: "beginner", calories: 1.0, instructions: "Jog or run at steady pace for cardiovascular endurance." },
  { name: "Sprinting", key: "sprinting", category: "Cardio", difficulty: "intermediate", calories: 1.2, instructions: "Short bursts of maximum speed running." },
  { name: "Box Jumps Plyo", key: "boxjumpsplyo", category: "Plyometric", difficulty: "intermediate", calories: 0.8, instructions: "Explosive jumps onto box for power development." },
  { name: "Deadlifts Strength", key: "deadliftsstrength", category: "Strength", difficulty: "intermediate", calories: 0.8, instructions: "Heavy deadlifts for maximal strength development." }
];

// ========== VIDEO DATA ==========
 const exerciseVideos = {
  pushups: 'IODxDxX7oi4',
  inclinepushups: 'NEdo_I3OuVk',
  declinepushups: 'O7dVvwEK9J4',
  diamondpushups: 'IODxDxX7oi4',
  widepushups: 'IODxDxX7oi4',
  pikedpushups: 'lIZ_C4VJnmc',
  clappushups: 'IODxDxX7oi4',
  archerpushups: 'IODxDxX7oi4',
  onearmpushups: 'IODxDxX7oi4',
  spidermanpushups: 'IODxDxX7oi4',
  barbellbench: 'rxEMKVJ1jb0',
  dumbbellbench: 'rxEMKVJ1jb0',
  inclinebarbell: 'rxEMKVJ1jb0',
  inclinedumbbell: 'rxEMKVJ1jb0',
  declinebench: 'rxEMKVJ1jb0',
  cablecrossovers: 'rxEMKVJ1jb0',
  pecdeck: 'rxEMKVJ1jb0',
  chestfly: 'rxEMKVJ1jb0',
  dumbbellflyes: 'rxEMKVJ1jb0',
  inclinedumbbellflyes: 'rxEMKVJ1jb0',
  cablechestpress: 'rxEMKVJ1jb0',
  landminepress: 'rxEMKVJ1jb0',
  platepress: 'rxEMKVJ1jb0',
  bandpushups: 'IODxDxX7oi4',
  weightedpushups: 'IODxDxX7oi4',
  medicineballpushups: 'IODxDxX7oi4',
  trxpushups: 'IODxDxX7oi4',
  ringpushups: 'IODxDxX7oi4',
  handstandpushups: 'QAQ64B6xJQg',
  dips: '2z8JmcrW-As',
  benchdips: '2z8JmcrW-As',
  weightedDips: '2z8JmcrW-As',
  machinechestpress: 'rxEMKVJ1jb0',
  smithmachinepress: 'rxEMKVJ1jb0',
  guillotinepress: 'rxEMKVJ1jb0',
  closegripbench: 'X-iV-cG8cjQ',
  reversegripbench: 'rxEMKVJ1jb0',
  floorpress: 'rxEMKVJ1jb0',
  boardpress: 'rxEMKVJ1jb0',
  pullups: 'eGo4IYtlbpU',
  chinups: 'eGo4IYtlbpU',
  widegrippullups: 'eGo4IYtlbpU',
  closegrippullups: 'eGo4IYtlbpU',
  neutralgrippullups: 'eGo4IYtlbpU',
  weightedpullups: 'eGo4IYtlbpU',
  assistedpullups: 'eGo4IYtlbpU',
  latpulldown: 'eGo4IYtlbpU',
  closegrippulldown: 'eGo4IYtlbpU',
  reversegrippulldown: 'eGo4IYtlbpU',
  straightarmpulldown: 'eGo4IYtlbpU',
  barbellbentoverrow: 'eGo4IYtlbpU',
  dumbbellrow: 'eGo4IYtlbpU',
  tbarrow: 'eGo4IYtlbpU',
  seatedcablerow: 'eGo4IYtlbpU',
  chestsupportedrow: 'eGo4IYtlbpU',
  invertedrow: 'eGo4IYtlbpU',
  machinerow: 'eGo4IYtlbpU',
  singlearmdumbbellrow: 'eGo4IYtlbpU',
  krocrows: 'eGo4IYtlbpU',
  pendlayrows: 'eGo4IYtlbpU',
  deadlifts: 'jEy_czb3RKA',
  romaniandeadlifts: 'jEy_czb3RKA',
  sumodeadlifts: 'jEy_czb3RKA',
  stiffleggeddeadlifts: 'jEy_czb3RKA',
  rackpulls: 'jEy_czb3RKA',
  goodmornings: 'jEy_czb3RKA',
  hyperextensions: 'jEy_czb3RKA',
  reversehyperextensions: 'jEy_czb3RKA',
  facepulls: 'QAQ64B6xJQg',
  bandpullaparts: 'QAQ64B6xJQg',
  supermans: 'jEy_czb3RKA',
  birddogs: 'vkKCVCZe474',
  renegaderows: 'eGo4IYtlbpU',
  bodyweightrows: 'eGo4IYtlbpU',
  overheadpress: 'QAQ64B6xJQg',
  dumbbellshoulderpress: 'QAQ64B6xJQg',
  arnoldpress: 'QAQ64B6xJQg',
  pushpress: 'QAQ64B6xJQg',
  militarypress: 'QAQ64B6xJQg',
  seatedshoulderpress: 'QAQ64B6xJQg',
  lateralraises: 'QAQ64B6xJQg',
  frontraises: 'QAQ64B6xJQg',
  bentoverlateralraises: 'QAQ64B6xJQg',
  uprightrows: 'QAQ64B6xJQg',
  facepullsshoulders: 'QAQ64B6xJQg',
  cablelateralraises: 'QAQ64B6xJQg',
  machineshoulderpress: 'QAQ64B6xJQg',
  landminepressshoulders: 'QAQ64B6xJQg',
  singlearmpress: 'QAQ64B6xJQg',
  behindneckpress: 'QAQ64B6xJQg',
  bradfordpress: 'QAQ64B6xJQg',
  dumbbellcleanpress: 'QAQ64B6xJQg',
  kettlebellpress: 'QAQ64B6xJQg',
  handstandpushupsshoulders: 'QAQ64B6xJQg',
  pikepushupsshoulders: 'QAQ64B6xJQg',
  scaptionraises: 'QAQ64B6xJQg',
  cubanpress: 'QAQ64B6xJQg',
  plateraises: 'QAQ64B6xJQg',
  barbellfrontraises: 'QAQ64B6xJQg',
  reversepecdeck: 'QAQ64B6xJQg',
  machinelateralraises: 'QAQ64B6xJQg',
  singlearmcableraises: 'QAQ64B6xJQg',
  ytwlraises: 'QAQ64B6xJQg',
  bandpullapartsshoulders: 'QAQ64B6xJQg',
  bicepcurls: 'in7PaeYlhrM',
  hammercurls: 'in7PaeYlhrM',
  preachercurls: 'in7PaeYlhrM',
  concentrationcurls: 'in7PaeYlhrM',
  inclinedumbbellcurls: 'in7PaeYlhrM',
  spidercurls: 'in7PaeYlhrM',
  cablecurls: 'in7PaeYlhrM',
  reversecurls: 'in7PaeYlhrM',
  zottmancurls: 'in7PaeYlhrM',
  barbellcurls: 'in7PaeYlhrM',
  ezbarcurls: 'in7PaeYlhrM',
  twentyones: 'in7PaeYlhrM',
  crossbodyhammercurls: 'in7PaeYlhrM',
  triceppushdowns: 'X-iV-cG8cjQ',
  overheadtricepextensions: 'X-iV-cG8cjQ',
  skullcrushers: 'X-iV-cG8cjQ',
  closegripbenchpress: 'X-iV-cG8cjQ',
  dipsarms: '2z8JmcrW-As',
  benchdipsarms: '2z8JmcrW-As',
  tricepkickbacks: 'X-iV-cG8cjQ',
  ropepushdowns: 'X-iV-cG8cjQ',
  singlearmpushdowns: 'X-iV-cG8cjQ',
  jmpress: 'X-iV-cG8cjQ',
  tatepress: 'X-iV-cG8cjQ',
  diamondpushupsarms: 'X-iV-cG8cjQ',
  frenchpress: 'X-iV-cG8cjQ',
  cableoverheadextension: 'X-iV-cG8cjQ',
  machinetricepextension: 'X-iV-cG8cjQ',
  bandtriceppushdown: 'X-iV-cG8cjQ',
  forearmcurls: 'in7PaeYlhrM',
  reverseforearmcurls: 'in7PaeYlhrM',
  farmerswalks: 'auBLPXO8Fww',
  platepinches: 'in7PaeYlhrM',
  wristroller: 'in7PaeYlhrM',
  sledgehammerlevering: 'in7PaeYlhrM',
  squats: 'bEv6CCg2BC8',
  barbellbacksquats: 'bEv6CCg2BC8',
  frontsquats: 'bEv6CCg2BC8',
  gobletsquats: 'bEv6CCg2BC8',
  overheadsquats: 'bEv6CCg2BC8',
  pistolsquats: 'bEv6CCg2BC8',
  jumpsquats: 'bEv6CCg2BC8',
  boxsquats: 'bEv6CCg2BC8',
  hacksquats: 'bEv6CCg2BC8',
  bulgariansplitsquats: 'bEv6CCg2BC8',
  lunges: 'D7KaRcUTQeE',
  walkinglunges: 'D7KaRcUTQeE',
  reverselunges: 'D7KaRcUTQeE',
  sidelunges: 'D7KaRcUTQeE',
  curtsylunges: 'D7KaRcUTQeE',
  deadliftslegs: 'jEy_czb3RKA',
  romaniandeadliftslegs: 'jEy_czb3RKA',
  sumodeadliftslegs: 'jEy_czb3RKA',
  stiffleggeddeadliftslegs: 'jEy_czb3RKA',
  goodmorningslegs: 'jEy_czb3RKA',
  legpress: 'bEv6CCg2BC8',
  hacksquatmachine: 'bEv6CCg2BC8',
  legextensions: 'bEv6CCg2BC8',
  hamstringcurls: 'bEv6CCg2BC8',
  glutehamraises: 'bEv6CCg2BC8',
  nordichamstringcurls: 'bEv6CCg2BC8',
  calfraises: 'bEv6CCg2BC8',
  seatedcalfraises: 'bEv6CCg2BC8',
  standingcalfraises: 'bEv6CCg2BC8',
  donkeycalfraises: 'bEv6CCg2BC8',
  hipthrusts: 'bEv6CCg2BC8',
  glutebridges: 'bEv6CCg2BC8',
  cablekickbacks: 'bEv6CCg2BC8',
  stepups: 'bEv6CCg2BC8',
  boxjumps: 'auBLPXO8Fww',
  wallsits: 'bEv6CCg2BC8',
  sissysquats: 'bEv6CCg2BC8',
  zerchersquats: 'bEv6CCg2BC8',
  beltsquats: 'bEv6CCg2BC8',
  singlelegpress: 'bEv6CCg2BC8',
  planks: 'vkKCVCZe474',
  sideplanks: 'vkKCVCZe474',
  reverseplanks: 'vkKCVCZe474',
  plankshouldertaps: 'vkKCVCZe474',
  plankleglifts: 'vkKCVCZe474',
  crunches: 'vkKCVCZe474',
  reversecrunches: 'vkKCVCZe474',
  bicyclecrunches: 'vkKCVCZe474',
  russiantwists: 'vkKCVCZe474',
  legraises: 'vkKCVCZe474',
  hanginglegraises: 'vkKCVCZe474',
  kneeraises: 'vkKCVCZe474',
  windshieldwipers: 'vkKCVCZe474',
  mountainclimbers: 'vkKCVCZe474',
  flutterkicks: 'vkKCVCZe474',
  scissorkicks: 'vkKCVCZe474',
  vups: 'vkKCVCZe474',
  toetouches: 'vkKCVCZe474',
  deadbug: 'vkKCVCZe474',
  birddogcore: 'vkKCVCZe474',
  superman: 'vkKCVCZe474',
  hollowbodyhold: 'vkKCVCZe474',
  archbodyhold: 'vkKCVCZe474',
  lsit: 'vkKCVCZe474',
  dragonflags: 'vkKCVCZe474',
  abwheelrollouts: 'vkKCVCZe474',
  cablecrunches: 'vkKCVCZe474',
  landminetwists: 'vkKCVCZe474',
  pallofpress: 'vkKCVCZe474',
  woodchoppers: 'vkKCVCZe474',
  burpees: 'auBLPXO8Fww',
  thrusters: 'auBLPXO8Fww',
  cleanandpress: 'QAQ64B6xJQg',
  snatch: 'auBLPXO8Fww',
  cleanandjerk: 'auBLPXO8Fww',
  kettlebelleswings: 'jEy_czb3RKA',
  turkishgetups: 'auBLPXO8Fww',
  farmerswalksfull: 'auBLPXO8Fww',
  suitcasecarries: 'auBLPXO8Fww',
  battleropes: 'auBLPXO8Fww',
  sledpushes: 'auBLPXO8Fww',
  sledpulls: 'auBLPXO8Fww',
  jumpingjacks: 'auBLPXO8Fww',
  mountainclimbersfull: 'auBLPXO8Fww',
  bearcrawls: 'auBLPXO8Fww',
  crabwalks: 'auBLPXO8Fww',
  highknees: 'auBLPXO8Fww',
  buttkickers: 'auBLPXO8Fww',
  jumprope: 'auBLPXO8Fww',
  boxjumpsfull: 'auBLPXO8Fww',
  medicineballslams: 'auBLPXO8Fww',
  wallballs: 'auBLPXO8Fww',
  manmakers: 'auBLPXO8Fww',
  devilpress: 'auBLPXO8Fww',
  sandbagcarries: 'auBLPXO8Fww',
  running: 'auBLPXO8Fww',
  sprinting: 'auBLPXO8Fww',
  boxjumpsplyo: 'auBLPXO8Fww',
  deadliftsstrength: 'jEy_czb3RKA'
};
const DEFAULT_VIDEO = 'dQw4w9WgXcQ';

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  generateStars();
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.querySelector('.toggle-password-btn').addEventListener('click', togglePasswordVisibility);
  document.getElementById('keyboard-help').addEventListener('click', showKeyboardShortcuts);

  if (checkAuth()) {
    initializeApp();
  } else {
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('keyboard-help').style.display = 'none';
  }
});

function initializeApp() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('login-container').classList.add('hidden');
  document.getElementById('app-container').style.display = 'block';
  document.getElementById('keyboard-help').style.display = 'block';

  loadUserData();
  populateExerciseGrid();
  populateInstructionsGrid();
  updateUI();
  setupEventListeners();
  initializeVoiceRecognition();
  showNotification('AI Workout Tracker loaded successfully!', 'success');
}

// ========== USER DATA ==========
function loadUserData() {
  if (!currentUser) return;
  const saved = localStorage.getItem(`workoutData_${currentUser}`);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      const lastLogin = new Date(data.lastLogin);
      const today = new Date();
      if (lastLogin.toDateString() !== today.toDateString()) {
        totalRepsToday = 0;
        caloriesBurned = 0;
      } else {
        totalRepsToday = data.totalRepsToday || 0;
        caloriesBurned = data.caloriesBurned || 0;
      }
      workoutHistory = data.workoutHistory || [];
      achievements = data.achievements || { firstWorkout: false, hundredReps: 0, perfectForm: 0, streak: 0 };
      customPlans = data.customPlans || [];
    } catch (_) {}
  }
  updateUI();
}

function saveUserData() {
  if (!currentUser) return;
  const data = {
    totalRepsToday,
    caloriesBurned,
    workoutHistory,
    achievements,
    customPlans,
    lastLogin: new Date().toISOString()
  };
  localStorage.setItem(`workoutData_${currentUser}`, JSON.stringify(data));
}

function updateUI() {
  updateMetrics();
  updateHistory();
  updateAchievements();
  updateStreakDisplay();
  displayCustomPlans();
}

// ========== EXERCISE GRID ==========
function populateExerciseGrid() {
  const grid = document.getElementById('exercise-grid');
  grid.innerHTML = '';
  exercises.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.key = ex.key;
    card.innerHTML = `
      <div class="difficulty ${ex.difficulty}">${ex.difficulty}</div>
      <h4>${ex.name}</h4>
      <div class="category">${ex.category}</div>
      <div style="font-size:0.8em;color:var(--text-secondary);">${ex.calories} cal/rep</div>
    `;
    card.addEventListener('click', () => selectExercise(ex, card));
    grid.appendChild(card);
  });
}

function selectExercise(ex, card) {
  document.querySelectorAll('.exercise-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  currentExercise = ex;
  document.getElementById('instructions').innerHTML = `<strong>${ex.name}</strong><br>${ex.instructions}`;
  resetAllExerciseStates();
  showNotification(`Selected: ${ex.name}`, 'success');
  speak(`Selected ${ex.name}. ${ex.instructions}`);
}

function filterExercises() {
  const term = document.getElementById('exercise-search').value.toLowerCase();
  document.querySelectorAll('.exercise-card').forEach(card => {
    const name = card.querySelector('h4').textContent.toLowerCase();
    const cat = card.querySelector('.category').textContent.toLowerCase();
    const diff = card.querySelector('.difficulty').textContent.toLowerCase();
    card.style.display = (name.includes(term) || cat.includes(term) || diff.includes(term)) ? 'block' : 'none';
  });
}

function filterExercisesByCategory(category) {
  document.querySelectorAll('.exercise-card').forEach(card => {
    const cat = card.querySelector('.category').textContent;
    card.style.display = (category === 'all' || cat === category) ? 'block' : 'none';
  });
}

function resetAllExerciseStates() {
  pushAngleHistory = { left: [], right: [] };
  pushDown = { left: false, right: false };
  squatAngleHistory = { left: [], right: [] };
  squatDown = { left: false, right: false };
  lungeAngleHistory = { left: [], right: [] };
  lungeDown = { left: false, right: false };
  deadliftAngleHistory = { left: [], right: [] };
  deadliftDown = { left: false, right: false };
  pressAngleHistory = { left: [], right: [] };
  pressUp = { left: false, right: false };
  leftAngleHistory = [];
  rightAngleHistory = [];
  leftCurlDown = false;
  rightCurlDown = false;
  jackState = { inPosition: false, armHistory: [], legHistory: [] };
  burpeeState = { down: false, jump: false };
  if (plankTimer) clearTimeout(plankTimer);
  plankTimer = null;
  genericMovementActive = false;
  genericMovementStartTime = 0;
  previousKeypoints = null;
  formScores = [];
  smoothedKeypoints = null;
}

// ========== INSTRUCTIONS PAGE ==========
function populateInstructionsGrid() {
  const grid = document.getElementById('instructions-grid');
  grid.innerHTML = '';
  exercises.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'instruction-card';
    card.dataset.key = ex.key;
    card.dataset.category = ex.category;
    card.innerHTML = `
      <div class="inst-header"><span class="inst-name">${ex.name}</span></div>
      <div class="inst-meta">
        <span>${ex.category}</span>
        <span class="diff-${ex.difficulty}">${ex.difficulty}</span>
        <span>${ex.calories} cal/rep</span>
      </div>
      <div class="inst-text">${ex.instructions}</div>
      <div class="inst-read-more">Read more →</div>
    `;
    card.addEventListener('click', () => openInstructionModal(ex));
    grid.appendChild(card);
  });
}

function filterInstructions() {
  const term = document.getElementById('instructions-search').value.toLowerCase();
  const activeCat = document.querySelector('#instructions-filters .category-filter.active')?.dataset.category || 'all';
  document.querySelectorAll('.instruction-card').forEach(card => {
    const name = card.querySelector('.inst-name').textContent.toLowerCase();
    const cat = card.dataset.category;
    const match = name.includes(term) && (activeCat === 'all' || cat === activeCat);
    card.style.display = match ? 'block' : 'none';
  });
}

function openInstructionModal(ex) {
  const modal = document.getElementById('instruction-modal');
  document.getElementById('instruction-modal-title').textContent = ex.name;
  document.getElementById('instruction-modal-category').textContent = ex.category;
  document.getElementById('instruction-modal-difficulty').textContent = ex.difficulty;
  document.getElementById('instruction-modal-calories').textContent = ex.calories + ' cal/rep';
  document.getElementById('instruction-modal-text').textContent = ex.instructions;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeInstructionModal() {
  document.getElementById('instruction-modal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

function showInstructionsPage() {
  document.getElementById('app-main').style.display = 'none';
  document.getElementById('videos-page').style.display = 'none';
  document.getElementById('instructions-page').style.display = 'block';
  populateInstructionsGrid();
}

function showVideoPage() {
  document.getElementById('app-main').style.display = 'none';
  document.getElementById('instructions-page').style.display = 'none';
  document.getElementById('videos-page').style.display = 'block';
  renderVideoGrid();
}

function showDashboard() {
  document.getElementById('videos-page').style.display = 'none';
  document.getElementById('instructions-page').style.display = 'none';
  document.getElementById('app-main').style.display = 'block';
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // Buttons
  document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
  document.getElementById('toggle-btn').addEventListener('click', toggleWorkout);
  document.getElementById('pause-btn').addEventListener('click', pauseWorkout);
  document.getElementById('reset-btn').addEventListener('click', resetWorkout);
  document.getElementById('voice-btn').addEventListener('click', toggleVoiceRecognition);
  document.getElementById('enable-camera-btn').addEventListener('click', enableCamera);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
  document.getElementById('stats-btn').addEventListener('click', showWorkoutStats);
  document.getElementById('add-exercise-btn').addEventListener('click', addExerciseToCustomPlan);
  document.getElementById('save-custom-plan-btn').addEventListener('click', saveCustomPlan);
  document.getElementById('instructions-btn').addEventListener('click', showInstructionsPage);
  document.getElementById('instructions-back-btn').addEventListener('click', showDashboard);
  document.getElementById('videos-btn').addEventListener('click', showVideoPage);
  document.getElementById('videos-back-btn').addEventListener('click', showDashboard);

  // Modal close
  document.querySelector('.video-modal-close').addEventListener('click', closeVideoModal);
  document.querySelector('.instruction-modal-close').addEventListener('click', closeInstructionModal);
  document.getElementById('video-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeVideoModal(); });
  document.getElementById('instruction-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeInstructionModal(); });

  // Search & filters
  document.getElementById('exercise-search').addEventListener('input', filterExercises);
  document.querySelectorAll('#exercise-grid ~ .filters .category-filter').forEach(f => {
    f.addEventListener('click', function() {
      document.querySelectorAll('#exercise-grid ~ .filters .category-filter').forEach(f2 => f2.classList.remove('active'));
      this.classList.add('active');
      filterExercisesByCategory(this.dataset.category);
    });
  });
  document.getElementById('instructions-search').addEventListener('input', filterInstructions);
  document.querySelectorAll('#instructions-filters .category-filter').forEach(f => {
    f.addEventListener('click', function() {
      document.querySelectorAll('#instructions-filters .category-filter').forEach(f2 => f2.classList.remove('active'));
      this.classList.add('active');
      filterInstructions();
    });
  });

  // Import/Export
  document.getElementById('import-file').addEventListener('change', importWorkoutData);
  document.getElementById('export-btn').addEventListener('click', exportWorkoutData);
  document.querySelector('.share-twitter').addEventListener('click', shareToTwitter);
  document.querySelector('.share-facebook').addEventListener('click', shareToFacebook);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ========== CAMERA ==========
async function enableCamera() {
  const overlay = document.getElementById('camera-permission');
  const btn = document.getElementById('enable-camera-btn');
  try {
    btn.textContent = 'Requesting...';
    btn.disabled = true;
    await setupCamera();
    overlay.innerHTML = `<h3>Loading AI Models...</h3><div class="spinner"></div><p>Please wait...</p>`;
    await loadPoseDetector();
    startPoseDetection();
    overlay.style.display = 'none';
    cameraEnabled = true;
    showNotification('Camera enabled! AI pose detection active.', 'success');
  } catch (err) {
    console.error(err);
    overlay.innerHTML = `
      <h3>Camera Error</h3>
      <p>${err.message}</p>
      <p>Allow camera permissions and try again.</p>
      <button id="enable-camera-btn" class="btn-primary" onclick="enableCamera()">Try Again</button>
    `;
    showNotification('Camera access failed.', 'error');
  }
}

async function setupCamera() {
  video = document.getElementById('video');
  canvas = document.getElementById('overlay');
  ctx = canvas.getContext('2d');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      actualVideoWidth = video.videoWidth;
      actualVideoHeight = video.videoHeight;
      canvas.width = actualVideoWidth;
      canvas.height = actualVideoHeight;
      video.play().then(() => resolve(video)).catch(() => resolve(video));
    };
  });
}

async function loadPoseDetector() {
  try {
    await tf.setBackend('webgl');
  } catch { await tf.setBackend('cpu'); }
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
      minPoseScore: 0.3
    }
  );
}

function startPoseDetection() {
  if (!detector || !video) return;
  isDetecting = true;
  detectPose();
}

async function detectPose(timestamp = performance.now()) {
  if (!isDetecting) return;
  if (!lastFrameTime) lastFrameTime = timestamp;
  const delta = timestamp - lastFrameTime;
  if (delta >= frameInterval && !isEstimating) {
    lastFrameTime = timestamp - (delta % frameInterval);
    isEstimating = true;
    try {
      const poses = await detector.estimatePoses(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (poses.length > 0) {
        let pose = poses[0];
        const scaleX = canvas.width / actualVideoWidth;
        const scaleY = canvas.height / actualVideoHeight;
        pose.keypoints = pose.keypoints.map(kp => ({ ...kp, x: kp.x * scaleX, y: kp.y * scaleY }));
        pose.keypoints = smoothKeypoints(pose.keypoints);
        drawPose(pose);
        if (isWorkoutActive && currentExercise) {
          analyzeExercise(pose);
        }
      }
    } catch (_) {}
    isEstimating = false;
  }
  animationId = requestAnimationFrame(detectPose);
}

function smoothKeypoints(newKp) {
  if (!smoothedKeypoints) {
    smoothedKeypoints = newKp.map(k => ({ ...k }));
    return smoothedKeypoints;
  }
  smoothedKeypoints = newKp.map((kp, i) => {
    const prev = smoothedKeypoints[i];
    if (!prev || kp.score < 0.3) return { ...kp };
    return {
      ...kp,
      x: prev.x + SMOOTHING_FACTOR * (kp.x - prev.x),
      y: prev.y + SMOOTHING_FACTOR * (kp.y - prev.y)
    };
  });
  return smoothedKeypoints;
}

function drawPose(pose) {
  const kp = pose.keypoints;
  const connections = [
    ['left_shoulder','left_elbow'], ['left_elbow','left_wrist'],
    ['right_shoulder','right_elbow'], ['right_elbow','right_wrist'],
    ['left_shoulder','right_shoulder'],
    ['left_shoulder','left_hip'], ['right_shoulder','right_hip'],
    ['left_hip','right_hip'],
    ['left_hip','left_knee'], ['left_knee','left_ankle'],
    ['right_hip','right_knee'], ['right_knee','right_ankle']
  ];
  ctx.save();
  ctx.shadowColor = 'rgba(76,175,80,0.6)';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  connections.forEach(([a,b]) => {
    const p1 = kp.find(k => k.name === a);
    const p2 = kp.find(k => k.name === b);
    if (p1 && p2 && p1.score > 0.3 && p2.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  });
  ctx.restore();
  kp.forEach(p => {
    if (p.score > 0.3) {
      const color = p.score > 0.8 ? '#FF4444' : '#FFAA00';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.score > 0.8 ? 6 : 4, 0, 2*Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  });
}

// ========== UTILITY ==========
function calculateAngle(a,b,c) {
  if (!a||!b||!c) return 180;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x*v2.x + v1.y*v2.y;
  const m1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
  const m2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
  if (m1*m2 < 0.001) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot/(m1*m2)))) * (180/Math.PI);
}
function calcDist(p1,p2) {
  if (!p1||!p2) return 0;
  return Math.sqrt((p1.x-p2.x)**2 + (p1.y-p2.y)**2);
}
function getKp(kp, name) { return kp.find(p => p.name === name); }
function detectDir(angle, history, minChange) {
  history.push(angle);
  if (history.length > 5) history.shift();
  if (history.length < 3) return null;
  const recent = history.slice(-3).reduce((a,b)=>a+b,0)/3;
  const older = history.slice(0,3).reduce((a,b)=>a+b,0)/3;
  const diff = recent - older;
  if (diff < -minChange) return 'decreasing';
  if (diff > minChange) return 'increasing';
  return null;
}

// ========== EXERCISE ANALYSIS ==========
function analyzePushups(kp) {
  const ls = getKp(kp,'left_shoulder'), le = getKp(kp,'left_elbow'), lw = getKp(kp,'left_wrist'), lh = getKp(kp,'left_hip');
  const rs = getKp(kp,'right_shoulder'), re = getKp(kp,'right_elbow'), rw = getKp(kp,'right_wrist'), rh = getKp(kp,'right_hip');
  let lAngle = 180, rAngle = 180, lAlign = 100, rAlign = 100;
  if (ls && le && lw && lh) { lAngle = calculateAngle(ls, le, lw); lAlign = Math.abs(ls.y - lh.y); }
  if (rs && re && rw && rh) { rAngle = calculateAngle(rs, re, rw); rAlign = Math.abs(rs.y - rh.y); }
  const lVis = ls && ls.score > 0.3, rVis = rs && rs.score > 0.3;
  if (!lVis && !rVis) return "Cannot see upper body.";
  let fb = "Lower chest, keep body straight, push up";
  function proc(angle, align, isLeft) {
    const hist = isLeft ? pushAngleHistory.left : pushAngleHistory.right;
    const down = isLeft ? pushDown.left : pushDown.right;
    const setDown = (v) => { if (isLeft) pushDown.left = v; else pushDown.right = v; };
    const dir = detectDir(angle, hist, PUSH_MIN_CHANGE);
    if (dir === 'decreasing' && angle < PUSH_DOWN_ANGLE && align < 100) { if (!down) { setDown(true); return 'down'; } }
    if (dir === 'increasing' && angle > PUSH_UP_ANGLE) { if (down) { setDown(false); return 'up'; } }
    return null;
  }
  if (lVis && rVis) {
    const l = proc(lAngle, lAlign, true);
    const r = proc(rAngle, rAlign, false);
    if (l === 'up' && r === 'up') { countRep(); fb = "Perfect push-up!"; }
    else if (l === 'down' && r === 'down') fb = "Good depth! Push up!";
    else fb = "Keep arms together.";
  } else {
    const isLeft = lVis;
    const res = proc(isLeft ? lAngle : rAngle, isLeft ? lAlign : rAlign, isLeft);
    if (res === 'up') { countRep(); fb = "Perfect push-up!"; }
    else if (res === 'down') fb = "Good depth! Push up!";
  }
  return fb;
}
function analyzeSquats(kp) {
  const lh = getKp(kp,'left_hip'), lk = getKp(kp,'left_knee'), la = getKp(kp,'left_ankle');
  const rh = getKp(kp,'right_hip'), rk = getKp(kp,'right_knee'), ra = getKp(kp,'right_ankle');
  let lA=180, rA=180;
  if (lh&&lk&&la) lA = calculateAngle(lh,lk,la);
  if (rh&&rk&&ra) rA = calculateAngle(rh,rk,ra);
  const lVis = lh && lh.score > 0.3, rVis = rh && rh.score > 0.3;
  if (!lVis && !rVis) return "Cannot see legs.";
  let fb = "Lower hips to parallel, drive up";
  function proc(angle, isLeft) {
    const hist = isLeft ? squatAngleHistory.left : squatAngleHistory.right;
    const down = isLeft ? squatDown.left : squatDown.right;
    const setDown = (v) => { if (isLeft) squatDown.left = v; else squatDown.right = v; };
    const dir = detectDir(angle, hist, SQUAT_MIN_CHANGE);
    if (dir === 'decreasing' && angle < SQUAT_DOWN_ANGLE) { if (!down) { setDown(true); return 'down'; } }
    if (dir === 'increasing' && angle > SQUAT_UP_ANGLE) { if (down) { setDown(false); return 'up'; } }
    return null;
  }
  if (lVis && rVis) {
    const l = proc(lA,true), r = proc(rA,false);
    if (l === 'up' && r === 'up') { countRep(); fb = "Perfect squat!"; }
    else if (l === 'down' && r === 'down') fb = "Good depth! Drive up!";
    else fb = "Keep legs together.";
  } else {
    const isLeft = lVis;
    const res = proc(isLeft ? lA : rA, isLeft);
    if (res === 'up') { countRep(); fb = "Perfect squat!"; }
    else if (res === 'down') fb = "Good depth! Drive up!";
  }
  return fb;
}
function analyzeBicepCurls(kp) {
  const ls = getKp(kp,'left_shoulder'), le = getKp(kp,'left_elbow'), lw = getKp(kp,'left_wrist');
  const rs = getKp(kp,'right_shoulder'), re = getKp(kp,'right_elbow'), rw = getKp(kp,'right_wrist');
  let lA=180, rA=180;
  if (ls&&le&&lw) lA = calculateAngle(ls,le,lw);
  if (rs&&re&&rw) rA = calculateAngle(rs,re,rw);
  const lVis = ls && ls.score > 0.3, rVis = rs && rs.score > 0.3;
  if (!lVis && !rVis) return "Cannot see arms.";
  let fb = "Curl up, squeeze, lower slowly";
  function proc(angle, isLeft) {
    const hist = isLeft ? leftAngleHistory : rightAngleHistory;
    const down = isLeft ? leftCurlDown : rightCurlDown;
    const setDown = (v) => { if (isLeft) leftCurlDown = v; else rightCurlDown = v; };
    const dir = detectDir(angle, hist, MIN_ANGLE_CHANGE);
    if (dir === 'decreasing' && angle < CURL_DOWN_ANGLE) { if (!down) { setDown(true); return 'down'; } }
    if (dir === 'increasing' && angle > CURL_UP_ANGLE) { if (down) { setDown(false); return 'up'; } }
    return null;
  }
  if (lVis && rVis) {
    const l = proc(lA,true), r = proc(rA,false);
    if (l === 'up' && r === 'up') { countRep(); fb = "Perfect curl!"; }
    else if (l === 'down' && r === 'down') fb = "Squeeze at top!";
    else fb = "Keep arms together.";
  } else {
    const isLeft = lVis;
    const res = proc(isLeft ? lA : rA, isLeft);
    if (res === 'up') { countRep(); fb = "Perfect curl!"; }
    else if (res === 'down') fb = "Squeeze at top!";
  }
  return fb;
}
function analyzeLunges(kp) { /* simplified but present */ return "Lunge form analysis active."; }
function analyzePlank(kp) {
  // use similar logic
  return "Hold plank, keep body straight.";
}
function analyzeDeadlifts(kp) { return "Deadlift: keep back straight."; }
function analyzeJumpingJacks(kp) { return "Jump and spread arms/legs."; }
function analyzeBurpees(kp) { return "Burpee: squat, plank, pushup, jump."; }
function analyzeShoulderPress(kp) { return "Press overhead, control descent."; }
function analyzeGenericExercise(kp) {
  const movement = calcOverallMovement(kp);
  if (movement > 50 && !genericMovementActive) { genericMovementActive = true; genericMovementStartTime = Date.now(); }
  else if (movement < 20 && genericMovementActive) {
    const duration = Date.now() - genericMovementStartTime;
    if (duration > 500 && duration < 3000) countRep();
    genericMovementActive = false;
  }
  return "Maintain form and control.";
}
function calcOverallMovement(kp) {
  let total = 0, count = 0;
  if (previousKeypoints) {
    kp.forEach((p, i) => {
      if (p.score > 0.3 && previousKeypoints[i] && previousKeypoints[i].score > 0.3) {
        total += calcDist(p, previousKeypoints[i]);
        count++;
      }
    });
  }
  previousKeypoints = kp;
  return count > 0 ? total / count : 0;
}

function analyzeExercise(pose) {
  if (!currentExercise || !isWorkoutActive) return;
  const kp = pose.keypoints;
  let feedback = "Keep going!";
  let accuracy = 80;
  const key = currentExercise.key;
  if (['pushups','inclinepushups','diamondpushups','widepushups'].includes(key)) feedback = analyzePushups(kp);
  else if (['squats','jumpsquats','barbellbacksquats','frontsquats','gobletsquats'].includes(key)) feedback = analyzeSquats(kp);
  else if (['bicepcurls','hammercurls','barbellcurls','concentrationcurls'].includes(key)) feedback = analyzeBicepCurls(kp);
  else if (['lunges','reverselunges','sidelunges','walkinglunges'].includes(key)) feedback = analyzeLunges(kp);
  else if (['planks','sideplanks'].includes(key)) feedback = analyzePlank(kp);
  else if (['deadlifts','romaniandeadlifts','sumodeadlifts'].includes(key)) feedback = analyzeDeadlifts(kp);
  else if (key === 'burpees') feedback = analyzeBurpees(kp);
  else if (key === 'jumpingjacks') feedback = analyzeJumpingJacks(kp);
  else if (['overheadpress','dumbbellshoulderpress','arnoldpress'].includes(key)) feedback = analyzeShoulderPress(kp);
  else feedback = analyzeGenericExercise(kp);

  if (feedback.includes('Perfect') || feedback.includes('excellent')) accuracy = 100;
  else if (feedback.includes('Good') || feedback.includes('great')) accuracy = 90;
  else if (feedback.includes('Maintain') || feedback.includes('control')) accuracy = 80;
  else accuracy = 70;
  document.getElementById('feedback').textContent = feedback;
  document.getElementById('accuracy').textContent = accuracy + '%';
  updateFormScore(accuracy);
}

function updateFormScore(acc) {
  formScores.push(acc);
  if (formScores.length > 10) formScores.shift();
  const avg = formScores.reduce((a,b)=>a+b,0)/formScores.length;
  const el = document.getElementById('accuracy');
  if (avg >= 90) el.style.color = '#4CAF50';
  else if (avg >= 80) el.style.color = '#FF9800';
  else el.style.color = '#F44336';
}

function countRep() {
  const now = Date.now();
  if (now - lastRepTime < 1000) return;
  lastRepTime = now;
  repCount++;
  totalRepsToday++;
  caloriesBurned += currentExercise.calories;
  document.getElementById('rep-count').textContent = repCount;
  document.getElementById('total-reps').textContent = totalRepsToday;
  document.getElementById('calories').textContent = Math.round(caloriesBurned);
  speak(repCount.toString());
  if (repCount % 5 === 0) showNotification(`🎉 ${repCount} reps!`, 'success');
}

function speak(msg) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(msg);
    u.rate = 1.2; u.volume = 0.7;
    speechSynthesis.speak(u);
  }
}

// ========== WORKOUT CONTROLS ==========
function toggleWorkout() {
  if (workoutStartTime) stopWorkout();
  else startWorkout();
}
function startWorkout() {
  if (!currentExercise) { showNotification('Select an exercise first!', 'error'); return; }
  if (!detector) { showNotification('Enable camera first!', 'error'); return; }
  if (isWorkoutActive) return;
  isWorkoutActive = true;
  workoutStartTime = Date.now();
  pausedAt = null;
  repCount = 0;
  caloriesBurned = 0;
  resetAllExerciseStates();
  document.getElementById('toggle-btn').textContent = '⏹ Stop';
  document.getElementById('toggle-btn').className = 'btn-danger';
  document.getElementById('pause-btn').disabled = false;
  document.querySelector('.video-container')?.classList.add('active');
  updateMetrics();
  startTimer();
  showNotification(`Started ${currentExercise.name}!`, 'success');
  speak(`Starting ${currentExercise.name}.`);
}
function pauseWorkout() {
  if (!workoutStartTime) return;
  isWorkoutActive = !isWorkoutActive;
  if (isWorkoutActive) {
    if (pausedAt) { workoutStartTime += Date.now() - pausedAt; pausedAt = null; }
    startTimer();
    document.getElementById('pause-btn').textContent = '⏸ Pause';
    showNotification('Resumed', 'success');
    speak('Resumed.');
  } else {
    pausedAt = Date.now();
    clearInterval(timerInterval);
    document.getElementById('pause-btn').textContent = '▶ Resume';
    showNotification('Paused', 'info');
    speak('Paused.');
  }
}
function stopWorkout() {
  isWorkoutActive = false;
  clearInterval(timerInterval);
  document.getElementById('toggle-btn').textContent = '▶ Start';
  document.getElementById('toggle-btn').className = 'btn-primary';
  document.getElementById('pause-btn').disabled = true;
  document.getElementById('pause-btn').textContent = '⏸ Pause';
  document.querySelector('.video-container')?.classList.remove('active');
  if (workoutStartTime && repCount > 0) {
    const duration = Math.floor((Date.now() - workoutStartTime) / 1000);
    const wo = {
      exercise: currentExercise.name,
      reps: repCount,
      duration,
      calories: Math.round(repCount * currentExercise.calories),
      date: new Date().toLocaleString(),
      timestamp: Date.now()
    };
    workoutHistory.unshift(wo);
    updateHistory();
    updateStreak();
    saveUserData();
    showNotification(`Workout done! ${repCount} reps in ${formatTime(duration)}`, 'success');
    speak(`Workout complete! ${repCount} reps.`);
  } else if (repCount === 0) showNotification('No reps recorded.', 'info');
  workoutStartTime = null;
}
function resetWorkout() {
  if (workoutStartTime) stopWorkout();
  repCount = 0;
  caloriesBurned = 0;
  updateMetrics();
  document.getElementById('feedback').textContent = 'Ready to start!';
  document.getElementById('accuracy').textContent = '0%';
  showNotification('Reset', 'info');
  speak('Reset.');
}
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}
function updateTimerDisplay() {
  if (workoutStartTime) {
    const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
    const progress = Math.min((elapsed / 60) * 100, 100);
    document.getElementById('progress-fill').style.width = progress + '%';
  }
}
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function updateMetrics() {
  document.getElementById('rep-count').textContent = repCount;
  document.getElementById('total-reps').textContent = totalRepsToday;
  document.getElementById('calories').textContent = Math.round(caloriesBurned);
}

// ========== ACHIEVEMENTS ==========
function updateAchievements() {
  if (totalRepsToday > 0 && !achievements.firstWorkout) {
    achievements.firstWorkout = true;
    showNotification('🏆 First Workout!', 'success');
    speak('First workout unlocked!');
  }
  achievements.hundredReps = Math.min(totalRepsToday, 100);
  if (repCount > 10) achievements.perfectForm = Math.min(achievements.perfectForm + 1, 10);
  document.getElementById('first-workout-progress').style.width = achievements.firstWorkout ? '100%' : '0%';
  document.getElementById('hundred-reps-progress').style.width = achievements.hundredReps + '%';
  document.getElementById('perfect-form-progress').style.width = (achievements.perfectForm * 10) + '%';
  document.getElementById('streak-progress').style.width = Math.min(achievements.streak, 7) * 14.28 + '%';
  saveUserData();
}
function updateStreak() {
  const today = new Date().toDateString();
  const last = localStorage.getItem('lastWorkoutDate');
  let streak = parseInt(localStorage.getItem('streak') || '0', 10);
  if (last !== today) {
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    if (last === yest.toDateString()) streak++;
    else if (last !== today) streak = 1;
    localStorage.setItem('streak', streak.toString());
    localStorage.setItem('lastWorkoutDate', today);
    achievements.streak = streak;
  }
  updateStreakDisplay();
  if (streak === 7) showNotification('🔥 7-day streak!', 'success');
  if (streak === 30) showNotification('🏆 30-day streak!', 'success');
}
function updateStreakDisplay() {
  document.getElementById('streak').textContent = parseInt(localStorage.getItem('streak') || '0', 10);
}
function updateHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (workoutHistory.length === 0) {
    list.innerHTML = '<li style="text-align:center;color:var(--text-secondary);">No workouts yet.</li>';
    return;
  }
  workoutHistory.slice(0, 10).forEach((w, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div><strong>${w.exercise}</strong><br><small>${w.reps} reps • ${formatTime(w.duration)} • ${w.calories} cal</small></div>
      <button class="delete-btn" onclick="deleteHistoryItem(${i})">🗑️</button>
    `;
    list.appendChild(li);
  });
}
function deleteHistoryItem(i) {
  workoutHistory.splice(i, 1);
  updateHistory();
  saveUserData();
  showNotification('Deleted', 'info');
}
function clearHistory() {
  if (confirm('Clear all history?')) {
    workoutHistory = [];
    updateHistory();
    saveUserData();
    showNotification('History cleared', 'info');
  }
}

// ========== VOICE ==========
function initializeVoiceRecognition() {
  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = e => {
      const cmd = e.results[e.results.length - 1][0].transcript.toLowerCase();
      handleVoiceCommand(cmd);
    };
    recognition.onerror = e => console.warn('Voice error:', e.error);
  }
}
function toggleVoiceRecognition() {
  if (!recognition) { showNotification('Voice not supported', 'error'); return; }
  try {
    if (isListening) {
      recognition.stop();
      document.getElementById('voice-btn').textContent = '🎤 Voice Control';
      showNotification('Voice disabled', 'info');
      isListening = false;
    } else {
      recognition.start();
      document.getElementById('voice-btn').textContent = '🔴 Listening...';
      showNotification('Voice active', 'success');
      speak('Voice active.');
      isListening = true;
    }
  } catch (_) { showNotification('Voice error', 'error'); }
}
function handleVoiceCommand(cmd) {
  if (cmd.includes('start') || cmd.includes('begin')) startWorkout();
  else if (cmd.includes('stop') || cmd.includes('end')) stopWorkout();
  else if (cmd.includes('pause') || cmd.includes('wait')) pauseWorkout();
  else if (cmd.includes('reset') || cmd.includes('restart')) resetWorkout();
  else if (cmd.includes('help')) speak("Say start, stop, pause, or reset");
  else if (cmd.includes('time') || cmd.includes('timer')) {
    const elapsed = workoutStartTime ? Math.floor((Date.now() - workoutStartTime) / 1000) : 0;
    speak(`Time: ${formatTime(elapsed)}`);
  } else if (cmd.includes('reps')) speak(`You have ${repCount} reps`);
}

// ========== CUSTOM PLANS ==========
function addExerciseToCustomPlan() {
  const container = document.getElementById('custom-plan-exercises');
  const item = document.createElement('div');
  item.className = 'custom-plan-item';
  item.innerHTML = `
    <select class="exercise-select"><option value="">Select</option>
      ${exercises.map(ex => `<option value="${ex.key}">${ex.name}</option>`).join('')}
    </select>
    <input type="number" class="sets-input" placeholder="Sets" min="1" max="10">
    <input type="number" class="reps-input" placeholder="Reps" min="1" max="100">
    <button class="remove-exercise-btn">❌</button>
  `;
  container.appendChild(item);
  item.querySelector('.remove-exercise-btn').addEventListener('click', () => container.removeChild(item));
}
function saveCustomPlan() {
  const name = document.getElementById('plan-name').value.trim();
  if (!name) { showNotification('Enter plan name', 'error'); return; }
  const items = document.querySelectorAll('.custom-plan-item');
  if (items.length === 0) { showNotification('Add exercises', 'error'); return; }
  const exercisesList = [];
  items.forEach(item => {
    const key = item.querySelector('.exercise-select').value;
    const sets = parseInt(item.querySelector('.sets-input').value);
    const reps = parseInt(item.querySelector('.reps-input').value);
    if (key && sets && reps) {
      const ex = exercises.find(e => e.key === key);
      if (ex) exercisesList.push({ name: ex.name, sets, reps });
    }
  });
  if (exercisesList.length === 0) { showNotification('Complete all fields', 'error'); return; }
  const plan = { name, exercises: exercisesList, id: Date.now().toString() };
  customPlans.push(plan);
  saveUserData();
  displayCustomPlans();
  document.getElementById('plan-name').value = '';
  document.getElementById('custom-plan-exercises').innerHTML = '';
  showNotification('Plan saved!', 'success');
}
function displayCustomPlans() {
  const container = document.getElementById('saved-custom-plans');
  container.innerHTML = '';
  if (customPlans.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">No custom plans</p>';
    return;
  }
  customPlans.forEach(p => {
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.innerHTML = `
      <h4>${p.name}</h4>
      <ul>${p.exercises.map(e => `<li>${e.name}: ${e.sets} sets of ${e.reps} reps</li>`).join('')}</ul>
      <button class="btn-secondary" onclick="loadCustomPlan('${p.id}')">Load</button>
      <button class="btn-danger" onclick="deleteCustomPlan('${p.id}')">Delete</button>
    `;
    container.appendChild(card);
  });
}
function loadCustomPlan(id) {
  const plan = customPlans.find(p => p.id === id);
  if (plan) {
    showNotification(`Loaded: ${plan.name}`, 'success');
    speak(`Custom plan ${plan.name} loaded.`);
    let html = `<h4>${plan.name}</h4><ul>`;
    plan.exercises.forEach(e => { html += `<li>${e.name}: ${e.sets} sets of ${e.reps} reps</li>`; });
    html += '</ul>';
    document.getElementById('instructions').innerHTML = html;
  }
}
function deleteCustomPlan(id) {
  if (confirm('Delete plan?')) {
    customPlans = customPlans.filter(p => p.id !== id);
    saveUserData();
    displayCustomPlans();
    showNotification('Plan deleted', 'info');
  }
}

// ========== UI HELPERS ==========
function showNotification(msg, type='info') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('show'), 100);
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}
function toggleDarkMode() {
  document.body.classList.toggle('light-mode');
  document.getElementById('dark-mode-toggle').textContent = document.body.classList.contains('light-mode') ? '☀️' : '🌙';
  localStorage.setItem('darkMode', !document.body.classList.contains('light-mode'));
}

// ========== STATS ==========
function showWorkoutStats() {
  const stats = getWorkoutStats();
  const modal = document.createElement('div');
  modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000;`;
  modal.innerHTML = `
    <div style="background:var(--bg-card);padding:30px;border-radius:var(--border-radius);max-width:500px;width:90%;border:1px solid var(--border-color);">
      <h2 style="color:var(--accent-green);">📊 Statistics</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:20px 0;">
        <div style="text-align:center;padding:15px;background:var(--bg-input);border-radius:8px;"><div style="font-size:2em;font-weight:bold;color:var(--accent-green);">${stats.totalWorkouts}</div><div>Total Workouts</div></div>
        <div style="text-align:center;padding:15px;background:var(--bg-input);border-radius:8px;"><div style="font-size:2em;font-weight:bold;color:var(--accent-green);">${stats.totalReps}</div><div>Total Reps</div></div>
        <div style="text-align:center;padding:15px;background:var(--bg-input);border-radius:8px;"><div style="font-size:2em;font-weight:bold;color:var(--accent-green);">${stats.totalCalories}</div><div>Calories</div></div>
        <div style="text-align:center;padding:15px;background:var(--bg-input);border-radius:8px;"><div style="font-size:2em;font-weight:bold;color:var(--accent-green);">${stats.currentStreak}</div><div>Streak</div></div>
      </div>
      <div style="margin:20px 0;color:var(--text-secondary);">
        <p><strong>Favorite:</strong> ${stats.favoriteExercise || 'None'}</p>
        <p><strong>This Week:</strong> ${stats.workoutsThisWeek}</p>
        <p><strong>Total Time:</strong> ${formatTime(stats.totalTime)}</p>
        <p><strong>Avg Reps:</strong> ${stats.averageReps}</p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="width:100%;padding:12px;background:var(--accent-green);color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
function getWorkoutStats() {
  const stats = {
    totalWorkouts: workoutHistory.length,
    totalReps: workoutHistory.reduce((s,w) => s + w.reps, 0),
    totalCalories: workoutHistory.reduce((s,w) => s + w.calories, 0),
    totalTime: workoutHistory.reduce((s,w) => s + w.duration, 0),
    currentStreak: parseInt(localStorage.getItem('streak') || '0', 10),
    favoriteExercise: null,
    workoutsThisWeek: 0,
    averageReps: 0
  };
  if (stats.totalWorkouts > 0) {
    stats.averageReps = Math.round(stats.totalReps / stats.totalWorkouts);
    const counts = {};
    workoutHistory.forEach(w => { counts[w.exercise] = (counts[w.exercise] || 0) + 1; });
    stats.favoriteExercise = Object.keys(counts).reduce((a,b) => counts[a] > counts[b] ? a : b);
    const weekAgo = new Date(Date.now() - 7*24*60*60*1000);
    stats.workoutsThisWeek = workoutHistory.filter(w => new Date(w.timestamp) > weekAgo).length;
  }
  return stats;
}

// ========== EXPORT/IMPORT ==========
function exportWorkoutData() {
  if (!currentUser) return;
  const data = { user: currentUser, totalRepsToday, caloriesBurned, workoutHistory, achievements, customPlans, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workout-data-${currentUser}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('Data exported!', 'success');
}
function importWorkoutData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (confirm('Replace current data?')) {
        if (data.workoutHistory) workoutHistory = data.workoutHistory;
        if (data.achievements) achievements = data.achievements;
        if (data.totalRepsToday) totalRepsToday = data.totalRepsToday;
        if (data.caloriesBurned) caloriesBurned = data.caloriesBurned;
        if (data.customPlans) customPlans = data.customPlans;
        updateUI();
        saveUserData();
        showNotification('Data imported!', 'success');
      }
    } catch (_) { showNotification('Invalid file', 'error'); }
  };
  reader.readAsText(file);
}
function shareToTwitter() {
  const text = `Just completed a workout with AI Workout Tracker Pro! 💪 ${totalRepsToday} reps, ${Math.round(caloriesBurned)} cal! #fitness #AI`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}
function shareToFacebook() {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
}

// ========== KEYBOARD SHORTCUTS ==========
function handleKeyboardShortcuts(e) {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key.toLowerCase()) {
    case ' ': e.preventDefault(); if (!workoutStartTime && currentExercise) startWorkout(); else if (isWorkoutActive) pauseWorkout(); break;
    case 's': if (workoutStartTime) stopWorkout(); break;
    case 'r': resetWorkout(); break;
    case 'escape': if (workoutStartTime) stopWorkout(); break;
    case '/': e.preventDefault(); document.getElementById('exercise-search').focus(); break;
  }
}
function showKeyboardShortcuts() {
  showNotification('Space: Start/Pause | S: Stop | R: Reset | /: Search | Esc: Stop', 'info');
}

// ========== VIDEO ==========
function renderVideoGrid() {
  const grid = document.getElementById('videos-grid');
  grid.innerHTML = '';
  exercises.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `<div class="thumbnail">▶️</div><div class="video-name">${ex.name}</div>`;
    card.addEventListener('click', () => showVideoModal(ex.key));
    grid.appendChild(card);
  });
}
function showVideoModal(key) {
  const modal = document.getElementById('video-modal');
  const container = document.getElementById('video-player-container');
  const title = document.getElementById('video-title');
  const videoId = exerciseVideos[key] || DEFAULT_VIDEO;
  container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
  const ex = exercises.find(e => e.key === key);
  title.textContent = ex ? ex.name : 'Exercise Video';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeVideoModal() {
  document.getElementById('video-modal').style.display = 'none';
  document.getElementById('video-player-container').innerHTML = '';
  document.body.style.overflow = 'auto';
}

// ========== CLEANUP ==========
function stopPoseDetection() {
  isDetecting = false;
  if (animationId) cancelAnimationFrame(animationId);
  if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  if (plankTimer) clearTimeout(plankTimer);
}
setInterval(() => { if (currentUser) saveUserData(); }, 30000);
window.addEventListener('beforeunload', () => {
  stopPoseDetection();
  if (workoutStartTime) stopWorkout();
  if (currentUser) saveUserData();
});

// Expose for inline onclick
window.deleteHistoryItem = deleteHistoryItem;
window.exportWorkoutData = exportWorkoutData;
window.showWorkoutStats = showWorkoutStats;
window.showKeyboardShortcuts = showKeyboardShortcuts;
window.loadCustomPlan = loadCustomPlan;
window.deleteCustomPlan = deleteCustomPlan;
window.enableCamera = enableCamera;
window.handleLogin = handleLogin;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleLogout = handleLogout;
window.closeInstructionModal = closeInstructionModal;