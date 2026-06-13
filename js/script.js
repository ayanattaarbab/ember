// Configuration and Application State
const HOST = "http://127.0.0.1:3000/";
const audio = new Audio();

let currentAlbum = null;
let currentAlbumInfo = null;
let currentSong = null;
let currentSongIndex = 0;
let songs = [];
let playing = false;
let shuffleState = false;
let repeatState = 0; // 0 = off, 1 = repeat all, 2 = repeat one
let likedSongs = {};

// Load liked songs from localStorage
function loadLikedSongs() {
  const stored = localStorage.getItem('emberLikedSongs');
  if (stored) {
    likedSongs = JSON.parse(stored);
  }
}

// Save current liked songs map to localStorage
function saveLikedSongs() {
  localStorage.setItem('emberLikedSongs', JSON.stringify(likedSongs));
}

// Check if a specific song is liked
function isSongLiked(album, songName) {
  const key = `${album}/${songName}`;
  return likedSongs[key] === true;
}

// Toggle liked state for a song and save
function toggleSongLike(album, songName) {
  const key = `${album}/${songName}`;
  likedSongs[key] = !likedSongs[key];
  saveLikedSongs();
  return likedSongs[key];
}

// Format seconds into m:ss format
function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// Format total seconds into a readable continuous duration string
function formatTotalDuration(totalSeconds) {
  totalSeconds = Math.floor(totalSeconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs} hr ${mins} min`;
  return `${mins} min ${secs} sec`;
}

// Fetch audio duration metadata without playing the file
function getAudioDuration(src) {
  return new Promise((resolve) => {
    const temp = new Audio(src);
    temp.addEventListener("loadedmetadata", () => resolve(temp.duration || 0));
    temp.addEventListener("error", () => resolve(0));
  });
}

// Handle song loading, UI status updates, and playback
async function playSong(songName, index) {
  currentSongIndex = index;
  currentSong = songName;

  const playerName = document.querySelector(".player-name");
  const playerArtist = document.querySelector(".player-artist");
  if (playerName) playerName.textContent = songName.replace(".mp3", "");
  if (playerArtist && currentAlbumInfo) playerArtist.textContent = currentAlbumInfo.artist;

  updatePlayingRow(index);

  audio.src = `${HOST}albums/${currentAlbum}/${encodeURIComponent(songName)}`;
  try {
    await audio.play();
    playing = true;
    pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } catch (err) {
    playing = false;
    pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
}

// Play/Pause button control toggling
const pauseBtn = document.querySelector('.ctrl-btn.play-pause');

pauseBtn.addEventListener("click", async () => {
  if (!audio.src) return;

  if (audio.paused) {
    try {
      await audio.play();
      playing = true;
      pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } catch (err) {
      // Browser autoplay policy catch block
    }
  } else {
    audio.pause();
    playing = false;
    pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
});

// Playback track position adjustment and real-time tracking
const progressTrack = document.querySelector('.progress-track');
const progressFill = document.querySelector('.progress-fill');
const timeLabels = document.querySelectorAll('.time-label');

let isSeeking = false;

function setProgress(clientX) {
  const rect = progressTrack.getBoundingClientRect();
  let percent = ((clientX - rect.left) / rect.width) * 100;
  percent = Math.max(0, Math.min(100, percent));
  progressFill.style.width = percent + "%";
  if (audio.duration) {
    audio.currentTime = (percent / 100) * audio.duration;
  }
}

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  const percent = (audio.currentTime / audio.duration) * 100;
  progressFill.style.width = percent + "%";
  if (timeLabels[0]) timeLabels[0].textContent = formatTime(audio.currentTime);
  if (timeLabels[1]) timeLabels[1].textContent = formatTime(audio.duration);
});

progressTrack.addEventListener('mousedown', (e) => {
  isSeeking = true;
  setProgress(e.clientX);
});

document.addEventListener('mousemove', (e) => {
  if (!isSeeking) return;
  setProgress(e.clientX);
});

document.addEventListener('mouseup', () => {
  isSeeking = false;
});

// Master volume slider and responsive icon controller
const volumeBtn = document.querySelector('.volume-btn');
const volumeBar = document.querySelector('.volume-bar');
const volumeFill = document.querySelector('.volume-fill');
const volumeIcon = volumeBtn.querySelector('i');

let volume = 70;
let lastVolume = 70;
let isDraggingVolume = false;

function renderVolume(v) {
  volume = Math.max(0, Math.min(100, v));
  audio.volume = volume / 100;
  volumeFill.style.width = volume + '%';

  if (volume === 0) volumeIcon.className = 'fa-solid fa-volume-xmark';
  else if (volume <= 50) volumeIcon.className = 'fa-solid fa-volume-low';
  else volumeIcon.className = 'fa-solid fa-volume-high';

  if (volume > 0) lastVolume = volume;
}

volumeBtn.addEventListener('click', () => {
  renderVolume(volume === 0 ? (lastVolume > 0 ? lastVolume : 70) : 0);
});

function updateVolume(clientX) {
  const rect = volumeBar.getBoundingClientRect();
  const percent = ((clientX - rect.left) / rect.width) * 100;
  renderVolume(percent);
}

volumeBar.addEventListener('mousedown', (e) => {
  isDraggingVolume = true;
  updateVolume(e.clientX);
});

document.addEventListener('mousemove', (e) => {
  if (!isDraggingVolume) return;
  updateVolume(e.clientX);
});

document.addEventListener('mouseup', () => {
  isDraggingVolume = false;
});

renderVolume(70);

// Shuffle mode toggle
const shuffleBtn = document.querySelector('.shuffle-btn');

shuffleBtn.addEventListener("click", () => {
  shuffleState = !shuffleState;
  shuffleBtn.style.color = shuffleState ? "#FF6B1A" : "";
});

// Repeat state management toggles
const repeatBtn = document.querySelector('.repeat-btn');
const repeatIcon = repeatBtn.querySelector('i');

repeatBtn.addEventListener("click", () => {
  repeatState = (repeatState + 1) % 3;

  repeatIcon.className = "fa-solid fa-repeat";
  repeatIcon.innerHTML = "";
  repeatIcon.style.position = "static";

  if (repeatState === 0) {
    repeatBtn.style.color = "";
  } else if (repeatState === 1) {
    repeatBtn.style.color = "#FF6B1A";
  } else {
    repeatBtn.style.color = "#FF6B1A";
    repeatIcon.style.position = "relative";

    const badge = document.createElement("span");
    badge.textContent = "1";
    badge.style.cssText = "position:absolute;font-size:8px;right:-6px;top:-4px;";
    repeatIcon.appendChild(badge);
  }
});

// Next and Previous navigation handlers
const nextBtn = document.querySelector(".ctrl-btn.next");
const prevBtn = document.querySelector(".ctrl-btn.prev");

nextBtn.addEventListener("click", () => {
  if (shuffleState) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * songs.length);
    } while (randomIndex === currentSongIndex && songs.length > 1);
    playSong(songs[randomIndex], randomIndex);
    return;
  }

  if (currentSongIndex < songs.length - 1) {
    playSong(songs[currentSongIndex + 1], currentSongIndex + 1);
  }
});

prevBtn.addEventListener("click", () => {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (currentSongIndex > 0) {
    playSong(songs[currentSongIndex - 1], currentSongIndex - 1);
  }
});

// Automated sequence dispatcher for end-of-track events
audio.addEventListener("ended", () => {
  if (repeatState === 2) {
    playSong(songs[currentSongIndex], currentSongIndex);
    return;
  }

  if (shuffleState) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * songs.length);
    } while (randomIndex === currentSongIndex && songs.length > 1);
    playSong(songs[randomIndex], randomIndex);
    return;
  }

  if (currentSongIndex < songs.length - 1) {
    playSong(songs[currentSongIndex + 1], currentSongIndex + 1);
  } else if (repeatState === 1) {
    playSong(songs[0], 0);
  } else {
    playing = false;
    pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
});

// Visual indicator styling updates for row elements
function updatePlayingRow(index) {
  document.querySelectorAll(".song-row").forEach(row => row.classList.remove("playing"));
  const activeRow = document.querySelector(`.song-row[data-index="${index}"]`);
  if (activeRow) activeRow.classList.add("playing");
}

// Hover event overlay toggles for custom lists
function attachRowHover(row) {
  const cell = row.querySelector('td:first-child');
  const original = cell.innerHTML;

  row.addEventListener('mouseenter', () => {
    if (!row.classList.contains("playing")) {
      cell.innerHTML = '<i class="fa-solid fa-play" style="font-size:11px;color:#FF6B1A"></i>';
    }
  });

  row.addEventListener('mouseleave', () => {
    if (!row.classList.contains("playing")) {
      cell.innerHTML = original;
    }
  });
}

// Asynchronously load card items into the library component panel
async function displayAlbums() {
  loadLikedSongs();

  const libraryList = document.querySelector(".library-list");
  const response = await fetch(`${HOST}albums/`);
  const html = await response.text();

  const div = document.createElement("div");
  div.innerHTML = html;
  const anchors = Array.from(div.getElementsByTagName("a"));

  let firstAlbum = null;

  for (const element of anchors) {
    if (!element.href.includes("albums")) continue;

    const folder = decodeURI(element.href.split("/").slice(-2)[0]).split("\\")[2];
    if (!firstAlbum) firstAlbum = folder;

    const infoRes = await fetch(`${HOST}/albums/${folder}/info.json`);
    const info = await infoRes.json();

    libraryList.innerHTML += `
      <div class="lib-item">
        <div class="lib-thumb" style="border-radius:6px;overflow:hidden;">
          <img src="${HOST}/albums/${folder}/cover.jpg" style="width:100%;height:100%;object-fit:cover;" />
        </div>
        <div class="lib-info">
          <div class="lib-name">${info.title}</div>
          <div class="lib-meta">Album • ${info.artist}</div>
        </div>
      </div>`;
  }

  if (firstAlbum) currentAlbum = firstAlbum;

  const libItems = Array.from(document.querySelectorAll(".lib-item"));

  libItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const el = e.currentTarget;
      const heroTitle = el.children[1].children[0].innerText;
      const heroArtist = el.children[1].children[1].innerText.split("•")[1].trim();
      const heroImage = el.children[0].firstElementChild.src;

      currentAlbumInfo = { title: heroTitle, artist: heroArtist };
      currentAlbum = heroImage.split("/albums/")[1].split("/")[0];

      document.querySelector(".hero").innerHTML = `
        <div class="hero-art">
          <img src="${heroImage}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        </div>
        <div class="hero-info">
          <div class="hero-label">Album</div>
          <div class="hero-title">${heroTitle}</div>
          <div class="hero-subtitle">Music by ${heroArtist}</div>
          <div class="hero-meta">
            <div class="ember-badge">
              <div class="ember-badge-icon">
                <i class="fa-solid fa-fire" style="color:#fff;font-size:11px;"></i>
              </div>
              <strong>Ember</strong>
            </div>
            <span>•</span>
            <span class="hero-song-count">— songs</span>
            <span>•</span>
            <span class="hero-total-duration">—</span>
          </div>
        </div>`;

      document.querySelector(".player-track").innerHTML = `
        <div class="player-thumb song-thumb player-song-thumb">
          <i class="fa-solid fa-music"></i>
        </div>
        <div class="player-info">
          <div class="player-name">${currentSong || ""}</div>
          <div class="player-artist">${heroArtist}</div>
        </div>`;

      getSongs(currentAlbum);
    });
  });

  if (libItems.length > 0) libItems[0].click();
}

displayAlbums();

// Process playlist view configurations and item rows setup
async function getSongs(album) {
  currentSongIndex = 0;
  currentSong = null;

  const response = await fetch(`${HOST}albums/${album}`);
  const html = await response.text();
  const div = document.createElement("div");
  div.innerHTML = html;
  const anchors = div.getElementsByTagName("a");

  songs = [];
  for (const el of anchors) {
    if (el.href.endsWith(".mp3")) songs.push(el.innerText);
  }

  const songsContainer = document.querySelector(".songList");
  songsContainer.innerHTML = "";

  let totalSeconds = 0;

  for (let i = 0; i < songs.length; i++) {
    const row = document.createElement("tr");
    row.className = "song-row";
    row.dataset.index = i;

    const src = `${HOST}albums/${album}/${encodeURIComponent(songs[i])}`;
    const duration = await getAudioDuration(src);
    const timeStr = duration > 0 ? formatTime(duration) : "--:--";
    totalSeconds += duration;

    const isLiked = isSongLiked(album, songs[i]);

    row.innerHTML = `
      <td>${i + 1}</td>
      <td>
        <div class="track-cell">
          <div class="track-thumb song-thumb">
            <i class="fa-solid fa-music"></i>
          </div>
          <div>
            <div class="track-name">${songs[i].replace(".mp3", "")}</div>
            <div class="track-artist">${currentAlbumInfo ? currentAlbumInfo.artist : "Unknown Artist"}</div>
          </div>
        </div>
      </td>
      <td>
        <button class="track-like-btn ${isLiked ? 'liked' : ''}">
          <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
      </td>
      <td>${timeStr}</td>`;

    songsContainer.appendChild(row);

    row.addEventListener("click", () => {
      playSong(songs[i], i);
    });

    row.querySelector('.track-like-btn').addEventListener('click', (e) => {
      e.stopPropagation();

      const icon = e.currentTarget.querySelector('i');
      const isNewLiked = toggleSongLike(album, songs[i]);

      if (isNewLiked) {
        icon.classList.replace('fa-regular', 'fa-solid');
        e.currentTarget.classList.add('liked');
      } else {
        icon.classList.replace('fa-solid', 'fa-regular');
        e.currentTarget.classList.remove('liked');
      }
    });

    attachRowHover(row);
  }

  const heroSongCount = document.querySelector(".hero-song-count");
  const heroTotalDuration = document.querySelector(".hero-total-duration");
  if (heroSongCount) heroSongCount.textContent = `${songs.length} song${songs.length !== 1 ? "s" : ""}`;
  if (heroTotalDuration) heroTotalDuration.textContent = formatTotalDuration(totalSeconds);

  if (songs.length > 0) {
    currentSong = songs[0];
    currentSongIndex = 0;
    audio.src = `${HOST}albums/${album}/${encodeURIComponent(songs[0])}`;

    const playerName = document.querySelector(".player-name");
    if (playerName) playerName.textContent = songs[0].replace(".mp3", "");

    updatePlayingRow(0);
    playing = false;
    pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

    const firstDuration = await getAudioDuration(
      `${HOST}albums/${album}/${encodeURIComponent(songs[0])}`
    );
    progressFill.style.width = "0%";
    if (timeLabels[0]) timeLabels[0].textContent = "0:00";
    if (timeLabels[1]) timeLabels[1].textContent = firstDuration > 0 ? formatTime(firstDuration) : "0:00";
  }
}

// Drawer overlay controller for mobile layouts
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openSidebarBtn');
  const closeBtn = document.getElementById('closeSidebarBtn');
  const sidebar = document.querySelector('.sidebar');

  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  if (openBtn && sidebar && overlay) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('open');
    });
  }

  const closeMenu = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);
});