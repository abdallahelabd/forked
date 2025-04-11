import React, { useState, useEffect, useRef } from "react";
import emailjs from "emailjs-com";
import { motion } from "framer-motion";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "firebase/storage";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCvJp9MjJ3CJGDcM1dj2U0LYBCtdc5BBmk",
  authDomain: "abdallahbio-18d4c.firebaseapp.com",
  databaseURL: "https://abdallahbio-18d4c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "abdallahbio-18d4c",
  storageBucket: "abdallahbio-18d4c.appspot.com",
  messagingSenderId: "1059962976137",
  appId: "1:1059962976137:web:5e60b5af318796e4b35358",
  measurementId: "G-GYD479RY6M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const chatCollection = collection(db, "chat");

// FirestoreImage component to render images stored directly in Firestore
const FirestoreImage = ({ imageId, className }) => {
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchImage = async () => {
      try {
        setLoading(true);
        console.log("FirestoreImage: Fetching image with ID:", imageId);
        
        if (!imageId) {
          setError("No image ID provided");
          return;
        }
        
        const docRef = doc(db, "chat_images", imageId);
        console.log("FirestoreImage: Getting document from path:", docRef.path);
        
        const docSnap = await getDoc(docRef);
        console.log("FirestoreImage: Document exists:", docSnap.exists());
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("FirestoreImage: Got data, image data exists:", !!data.data);
          
          if (data && data.data) {
            setImageData(data.data);
          } else {
            setError("Image data is missing");
            console.error("Image data is missing in document:", imageId);
          }
        } else {
          setError("Image not found");
          console.error("No image found with ID:", imageId);
        }
      } catch (err) {
        setError(err.message);
        console.error("Error fetching image:", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (imageId) {
      fetchImage();
    }
  }, [imageId]);
  
  if (loading) return <div className="text-green-400 text-xs flex items-center justify-center h-20 w-full">Loading image...</div>;
  if (error) return <div className="text-red-400 text-xs flex items-center justify-center h-20 w-full bg-black/30 rounded border border-red-600 p-2">Error: {error}</div>;
  if (!imageData) return <div className="text-yellow-400 text-xs flex items-center justify-center h-20 w-full bg-black/30 rounded border border-yellow-600 p-2">Image not available</div>;
  
  return (
    <img 
      src={imageData}
      alt="Attached" 
      className={className}
      onClick={() => {
        // Open image in new tab
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(`
            <html>
              <head><title>Image</title></head>
              <body style="margin: 0; display: flex; justify-content: center; align-items: center; background: #000;">
                <img src="${imageData}" style="max-width: 100%; max-height: 100vh;" />
              </body>
            </html>
          `);
        } else {
          alert("Popup blocked. Please allow popups to view the full image.");
        }
      }}
    />
  );
};

function PinnedCommands({ setCommand, inputRef, executeCommand }) {
  // Add "cv" to the pinned commands
  const pinnedCommands = ["hello", "experience", "skills", "CV", "chat"];
  
  const handlePinnedCommand = (cmd) => {
    // Execute the command directly instead of going through the input field
    executeCommand(cmd);
  };
  
  return (
    <div className="mt-10 border border-green-700 p-4 rounded-xl bg-green-900/10 backdrop-blur-md">
      <p className="text-green-300 text-xl mb-3 font-bold underline">Pinned Commands</p>
      <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
        {pinnedCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => handlePinnedCommand(cmd)}
            className="px-5 py-2.5 bg-green-500 text-black font-bold rounded-full shadow-lg hover:bg-green-400 hover:scale-105 transition-all duration-200 tracking-wide text-lg"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}

const handleReaction = async (msg, emoji, setChatLog) => {
  try {
    const docRef = doc(db, 'chat', msg.id);

    // Toggle reaction - if same emoji is clicked, remove it, otherwise set new emoji
    const newReaction = msg.reaction === emoji ? "" : emoji;

    // Update local state immediately for better UX
    setChatLog(prev =>
      prev.map(m => (m.id === msg.id ? { ...m, reaction: newReaction } : m))
    );

    // Update in Firestore
    await updateDoc(docRef, { 
      reaction: newReaction,
      reactionTime: serverTimestamp()
    });
    
    console.log(`Reaction updated: ${emoji} for message ID ${msg.id}`);
  } catch (err) {
    console.error("❌ Failed to update reaction:", err);
    alert("Failed to update reaction. Please try again.");
  }
};

export default function BioSite() {
  const [command, setCommand] = useState("");
  const [staticOutput, setStaticOutput] = useState([]);
  const [animatedOutput, setAnimatedOutput] = useState([]);
  const [queuedLines, setQueuedLines] = useState([]);
  const [lineDelay, setLineDelay] = useState(0);
  const [chatMode, setChatMode] = useState(false);
  const [booting, setBooting] = useState(true);
  const [chatLog, setChatLog] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userName, setUserName] = useState(() => {
    const stored = localStorage.getItem("userName");
    if (stored) return stored;
    const generated = "User" + Math.floor(Math.random() * 1000);
    localStorage.setItem("userName", generated);
    return generated;
  });
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("isAdmin") === "true");
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const fileInputRef = useRef(null);
  // Add a new ref to track if animation is in progress
  const isAnimating = useRef(false);

  // Function to collect visitor information
  const collectVisitorInfo = async (visitId) => {
    try {
      console.log("Collecting visitor information...");
      
      // Get device information
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        onlineStatus: navigator.onLine,
        deviceMemory: navigator.deviceMemory || 'Not available',
        cpuCores: navigator.hardwareConcurrency || 'Not available',
        connectionType: navigator.connection ? navigator.connection.effectiveType : 'Not available',
        batteryLevel: null, // Will be updated if available
        referrer: document.referrer || 'Direct',
        timestamp: new Date().toISOString(),
        visitorId: userName,
        visitId: visitId || `${new Date().getTime()}_${Math.random().toString(36).substring(2, 10)}`,
        previousVisits: localStorage.getItem("visitCount") || 0,
        currentURL: window.location.href,
        pagePath: window.location.pathname,
        queryParams: window.location.search,
        pageTitle: document.title,
        deviceType: /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      };
      
      // Try to get battery information
      if (navigator.getBattery) {
        try {
          const battery = await navigator.getBattery();
          deviceInfo.batteryLevel = battery.level;
          deviceInfo.batteryCharging = battery.charging;
        } catch (err) {
          console.log("Battery info not available:", err);
        }
      }
      
      // Try to get IP information from a third-party service
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        deviceInfo.ipAddress = ipData.ip;
        
        // Optionally get more IP info
        const geoResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
        const geoData = await geoResponse.json();
        deviceInfo.ipInfo = {
          city: geoData.city,
          region: geoData.region,
          country: geoData.country_name,
          postal: geoData.postal,
          isp: geoData.org
        };
      } catch (err) {
        console.log("IP info not available:", err);
        deviceInfo.ipAddress = "Not available";
      }
      
      // Try to get browser features and capabilities
      try {
        const features = {
          localStorage: typeof localStorage !== 'undefined',
          sessionStorage: typeof sessionStorage !== 'undefined',
          webGL: (function() {
            try {
              const canvas = document.createElement('canvas');
              return !!window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            } catch(e) {
              return false;
            }
          })(),
          canvas: (function() {
            try {
              const canvas = document.createElement('canvas');
              return !!(canvas.getContext && canvas.getContext('2d'));
            } catch(e) {
              return false;
            }
          })(),
          audio: !!window.AudioContext || !!window.webkitAudioContext,
          video: !!document.createElement('video').canPlayType,
          touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
          notifications: 'Notification' in window
        };
        deviceInfo.features = features;
      } catch (err) {
        console.log("Error collecting browser features:", err);
      }
      
      console.log("Collected visitor information:", deviceInfo);
      
      // Store in Firestore
      const visitorCollection = collection(db, "visitors");
      const docRef = await addDoc(visitorCollection, {
        ...deviceInfo,
        type: "page_visit",
        timestamp: serverTimestamp()
      });
      
      console.log("Visitor information stored with ID:", docRef.id);
      
      // Update visit count in localStorage
      const currentCount = parseInt(localStorage.getItem("visitCount") || "0");
      localStorage.setItem("visitCount", (currentCount + 1).toString());
      
      // Setup tracking for page activity
      setupActivityTracking(visitId || deviceInfo.visitId);
      
      // Optional: Send email notification about visitor
      try {
        // Only send emails for first-time visitors or once per day for returning visitors
        const lastEmailSent = localStorage.getItem("lastEmailSent");
        const shouldSendEmail = !lastEmailSent || 
                               (new Date().getTime() - new Date(lastEmailSent).getTime() > 24 * 60 * 60 * 1000);
        
        if (shouldSendEmail) {
          await emailjs.send("service_vjg01x9", "template_venfmmq", {
            user_name: "System",
            message: `Visitor: ${userName} using ${deviceInfo.platform} (${deviceInfo.userAgent.substring(0, 100)}...) from ${deviceInfo.ipInfo?.country || 'unknown location'} - Visit #${currentCount + 1}`,
            to_email: "abdallahelabd05@gmail.com"
          }, "iqh5uRT5wWx4PA9DC");
          
          localStorage.setItem("lastEmailSent", new Date().toISOString());
        }
      } catch (error) {
        console.error("❌ Email notification failed:", error);
      }
      
      console.log("Visitor information stored successfully");
    } catch (error) {
      console.error("Failed to collect or store visitor information:", error);
    }
  };
  
  // Setup function for tracking user activity
  const setupActivityTracking = (visitId) => {
    if (!visitId) return;
    
    // Track commands
    const trackActivity = (activityType, activityData = {}) => {
      try {
        const activityCollection = collection(db, "visitor_activity");
        addDoc(activityCollection, {
          visitId,
          userName,
          activityType,
          ...activityData,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Error tracking activity:", error);
      }
    };
    
    // Store the trackActivity function on window for global access
    window.trackActivity = trackActivity;
    
    // Track user activity such as scrolling, mouse movement, etc.
    let lastScrollTrack = 0;
    let lastMouseTrack = 0;
    let lastTouchTrack = 0;
    
    // Track scrolling (but not too frequently)
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTrack > 3000) { // Track every 3 seconds of scrolling at most
        lastScrollTrack = now;
        trackActivity("scroll", {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          scrollPercentage: (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100).toFixed(2)
        });
      }
    };
    
    // Track mouse movement (but not too frequently)
    const handleMouseMove = (e) => {
      const now = Date.now();
      if (now - lastMouseTrack > 10000) { // Track every 10 seconds at most
        lastMouseTrack = now;
        trackActivity("mouse_activity");
      }
    };
    
    // Track touches on mobile devices
    const handleTouch = () => {
      const now = Date.now();
      if (now - lastTouchTrack > 5000) { // Track every 5 seconds at most
        lastTouchTrack = now;
        trackActivity("touch_activity");
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      delete window.trackActivity;
    };
  };
  
  // Run visitor information collection on component mount
  useEffect(() => {
    // Create a unique visit ID for this session
    const visitId = new Date().getTime() + "_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("currentVisitId", visitId);
    
    // Track every visit, but with a slight delay to ensure component is fully mounted
    setTimeout(() => {
      collectVisitorInfo(visitId);
    }, 1000);
    
    // Record session start time
    localStorage.setItem("sessionStartTime", new Date().toISOString());
    
    // Create a heartbeat interval to track active sessions
    const heartbeatInterval = setInterval(() => {
      try {
        const visitorCollection = collection(db, "visitors");
        addDoc(visitorCollection, {
          type: "heartbeat",
          visitId: visitId,
          userName: userName,
          pageActive: !document.hidden,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Error sending heartbeat:", error);
      }
    }, 60000); // Send heartbeat every minute
    
    // Track when the user leaves the site
    const handleBeforeUnload = () => {
      // Calculate session duration
      const startTime = localStorage.getItem("sessionStartTime");
      if (startTime) {
        const duration = new Date().getTime() - new Date(startTime).getTime();
        const durationInMinutes = (duration / 60000).toFixed(2);
        
        // Add session duration to Firestore (this is async but might not complete before page unload)
        try {
          const visitorCollection = collection(db, "visitors");
          addDoc(visitorCollection, {
            type: "session_end",
            visitId: visitId,
            userName: userName,
            sessionDuration: durationInMinutes,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          console.error("Error recording session end:", error);
        }
      }
    };
    
    // Track when page becomes visible/hidden
    const handleVisibilityChange = () => {
      try {
        const visitorCollection = collection(db, "visitors");
        addDoc(visitorCollection, {
          type: "visibility_change",
          visitId: visitId,
          userName: userName,
          isHidden: document.hidden,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Error tracking visibility:", error);
      }
    };
    
    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup function to remove event listeners and intervals
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeatInterval);
    };
  }, [userName]);

  useEffect(() => {
    const q = query(chatCollection, orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (!isAdmin) {
        // Mark messages as seen by user
        messages
          .filter((msg) => msg.recipient === userName && !msg.seenByUser)
          .forEach((msg) => {
            const docRef = doc(db, "chat", msg.id);
            updateDoc(docRef, {
              seenByUser: true,
              seenTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
            });
          });
      }

      if (isAdmin) {
        // Mark messages as seen by admin
        messages
          .filter((msg) => !msg.seenByAdmin && msg.userName !== "Abdallah")
          .forEach((msg) => {
            const docRef = doc(db, "chat", msg.id);
            updateDoc(docRef, { seenByAdmin: true });
          });
      }

      setChatLog(messages);
    });

    return () => unsubscribe();
  }, [isAdmin, userName, adminPanelOpen]);

  useEffect(() => {
    const scrollToBottom = setTimeout(() => {
      outputRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return () => clearTimeout(scrollToBottom);
  }, [staticOutput, animatedOutput, chatLog]);

  // Fixed animation handling for CV content display
  useEffect(() => {
    if (queuedLines.length > 0 && animatedOutput.length === 0 && !isAnimating.current) {
      isAnimating.current = true;
      const [next, ...rest] = queuedLines;
      setAnimatedOutput([next]);
      setQueuedLines(rest);
    }
  }, [queuedLines, animatedOutput]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Only accept images under 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 5MB.");
      return;
    }
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    setSelectedImage(file);
  };

  const clearImageSelection = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) return null;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Check file size again
      if (selectedImage.size > 5 * 1024 * 1024) {
        alert("Image is too large. Maximum size is 5MB.");
        setUploading(false);
        return null;
      }
      
      console.log("Starting upload process with file:", selectedImage.name, "Size:", selectedImage.size, "Type:", selectedImage.type);
      
      // Create a promise to read the file as data URL
      const reader = new FileReader();
      const imageDataPromise = new Promise((resolve, reject) => {
        reader.onload = (e) => {
          console.log("FileReader success, data URL length:", e.target.result.length);
          resolve(e.target.result);
        };
        reader.onerror = (e) => {
          console.error("FileReader error:", e);
          reject(new Error("Failed to read file"));
        };
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentLoaded = Math.round((e.loaded / e.total) * 25); // Max 25% for reading
            console.log("File reading progress:", percentLoaded);
            setUploadProgress(percentLoaded);
          }
        };
      });
      
      // Start reading
      reader.readAsDataURL(selectedImage);
      console.log("Started FileReader...");
      
      // Wait for the file to be read
      const imageData = await imageDataPromise;
      console.log("Image data obtained, length:", imageData.length);
      setUploadProgress(25);
      
      // Check if data is valid
      if (!imageData || !imageData.startsWith('data:')) {
        throw new Error("Invalid image data format");
      }
      
      // Generate a unique ID for the image
      const timestamp = new Date().getTime();
      const imageId = `${userName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
      console.log("Generated image ID:", imageId);
      
      // Create image metadata
      const imageMetadata = {
        id: imageId,
        name: selectedImage.name,
        type: selectedImage.type,
        size: selectedImage.size,
        timestamp: timestamp,
        uploadedBy: userName
      };
      
      console.log("Storing in Firestore with metadata:", imageMetadata);
      setUploadProgress(50);
      
      // Add the image data to Firestore
      const imageCollection = collection(db, "chat_images");
      console.log("Attempting to write to Firestore collection 'chat_images'...");
      
      try {
        const docRef = await addDoc(imageCollection, {
          data: imageData,
          metadata: imageMetadata,
          timestamp: serverTimestamp()
        });
        
        console.log("Image data stored in Firestore with ID:", docRef.id);
        setUploadProgress(100);
        setUploading(false);
        
        // Return the document ID as our "image URL"
        return {
          id: docRef.id,
          isFirestoreImage: true
        };
      } catch (firestoreError) {
        console.error("Firestore write error:", firestoreError);
        console.error("Error code:", firestoreError.code);
        console.error("Error message:", firestoreError.message);
        throw firestoreError;
      }
    } catch (error) {
      console.error("Error during direct upload:", error);
      setUploading(false);
      setUploadProgress(0);
      alert(`Upload failed: ${error.message}`);
      return null;
    }
  };

  const handleAdminImageUpload = async (e, participant) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Only accept images under 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 5MB.");
      return;
    }
    
    // Display a temporary loading message
    const timestamp = new Date().getTime();
    const tempLoadingId = "temp-" + timestamp;
    setChatLog(prev => [...prev, { 
      id: tempLoadingId, 
      user: "Uploading image...", 
      userName: "Abdallah",
      recipient: participant,
      timestamp: new Date()
    }]);
    
    try {
      // Create a promise to read the file as data URL
      const reader = new FileReader();
      const imageDataPromise = new Promise((resolve, reject) => {
        reader.onload = (e) => {
          console.log("Admin upload: FileReader success, data URL length:", e.target.result.length);
          resolve(e.target.result);
        };
        reader.onerror = (e) => {
          console.error("Admin upload: FileReader error:", e);
          reject(new Error("Failed to read file"));
        };
      });
      
      // Start reading
      console.log("Admin upload: Starting FileReader for file:", file.name, "Size:", file.size, "Type:", file.type);
      reader.readAsDataURL(file);
      
      // Update the temporary message with progress
      setChatLog(prev => prev.map(msg => 
        msg.id === tempLoadingId 
          ? { ...msg, user: `Uploading image... 25%` }
          : msg
      ));
      
      // Wait for the file to be read
      const imageData = await imageDataPromise;
      console.log("Admin upload: Image data obtained, length:", imageData.length);
      
      // Update progress
      setChatLog(prev => prev.map(msg => 
        msg.id === tempLoadingId 
          ? { ...msg, user: `Uploading image... 50%` }
          : msg
      ));
      
      // Check if data is valid
      if (!imageData || !imageData.startsWith('data:')) {
        throw new Error("Invalid image data format");
      }
      
      // Generate a unique ID for the image
      const imageId = `Abdallah_${timestamp}`;
      console.log("Admin upload: Generated image ID:", imageId);
      
      // Create image metadata
      const imageMetadata = {
        id: imageId,
        name: file.name,
        type: file.type,
        size: file.size,
        timestamp: timestamp,
        uploadedBy: "Abdallah",
        recipient: participant
      };
      
      console.log("Admin upload: Storing in Firestore with metadata:", imageMetadata);
      
      // Update progress
      setChatLog(prev => prev.map(msg => 
        msg.id === tempLoadingId 
          ? { ...msg, user: `Uploading image... 75%` }
          : msg
      ));
      
      // Add the image data to Firestore
      const imageCollection = collection(db, "chat_images");
      console.log("Admin upload: Attempting to write to Firestore collection 'chat_images'...");
      
      try {
        const docRef = await addDoc(imageCollection, {
          data: imageData,
          metadata: imageMetadata,
          timestamp: serverTimestamp()
        });
        
        console.log("Admin upload: Image data stored in Firestore with ID:", docRef.id);
        
        // Update progress to 100%
        setChatLog(prev => prev.map(msg => 
          msg.id === tempLoadingId 
            ? { ...msg, user: `Uploading image... 100%` }
            : msg
        ));
        
        // Remove the temporary message
        setChatLog(prev => prev.filter(msg => msg.id !== tempLoadingId));
        
        // Check if admin message actually contains image data
        const checkDoc = await getDoc(doc(db, "chat_images", docRef.id));
        if (checkDoc.exists() && checkDoc.data().data) {
          console.log("Admin upload: Verified image data exists in Firestore document");
        } else {
          console.error("Admin upload: Image data not found in newly created document!");
        }
        
        // Add the image message to the chat
        await addDoc(chatCollection, {
          user: "",
          recipient: participant,
          userName: "Abdallah",
          time: new Date().toLocaleTimeString(),
          timestamp: serverTimestamp(),
          seenByUser: false,
          imageUrl: docRef.id, // Use document ID as the image reference
          isFirestoreImage: true // Flag to indicate this is a Firestore-stored image
        });
        
      } catch (firestoreError) {
        console.error("Admin upload: Firestore write error:", firestoreError);
        console.error("Error code:", firestoreError.code);
        console.error("Error message:", firestoreError.message);
        throw firestoreError;
      }
      
    } catch (error) {
      console.error("Error during direct admin upload:", error);
      // Remove the temporary message on error
      setChatLog(prev => prev.filter(msg => msg.id !== tempLoadingId));
      alert(`Upload failed: ${error.message}`);
    }
  };

  // Add an admin command to view analytics
  const showAnalytics = () => {
    if (!isAdmin) {
      setStaticOutput((prev) => [...prev, "❌ Admin access required to view analytics."]);
      return;
    }
    
    setStaticOutput((prev) => [...prev, 
      "📊 Analytics Dashboard", 
      "Visit data is being collected and stored in Firebase.",
      "Access your Firebase console to view complete visitor information:",
      "- Collection: visitors (main visit data)",
      "- Collection: visitor_activity (detailed user interactions)",
      "",
      "Analytics include:",
      "• Complete visitor device information",
      "• Session duration and activity",
      "• Commands executed",
      "• Page visibility and user engagement",
      "• Geographic location data",
      "",
      "To export data, use the Firebase console or create a custom export function."
    ]);
  };

  // Direct command execution function for pinned commands
  const executeCommand = (cmd) => {
    // Add command to output first
    setStaticOutput((prev) => [...prev, `$ ${cmd}`]);
    
    // Track command execution
    if (window.trackActivity) {
      window.trackActivity("command_executed", { command: cmd });
    }
    
    // Clear any existing queue and animation state to prevent interference
    setQueuedLines([]);
    setAnimatedOutput([]);
    isAnimating.current = false;
    
    let result = [];
    switch (cmd) {
      case "clear":
        setStaticOutput((prev) => [...prev, "🪩 This command no longer clears global chat."]);
        return;
      case "admin":
        if (isAdmin) {
          setAdminPanelOpen(true);
          setStaticOutput((prev) => [...prev, "Admin panel opened."]);
        } else {
          // For non-admins, we'll leave this to be handled via the normal command input
          setCommand("admin lalaelabd2005");
          inputRef.current?.focus();
        }
        return;
      case "logout":
        setIsAdmin(false);
        localStorage.removeItem("isAdmin");
        setStaticOutput((prev) => [...prev, "🚩 Logged out of admin mode."]);
        return;
      case "analytics":
        showAnalytics();
        return;
      case "chat":
        setChatMode(true);
        setStaticOutput((prev) => [...prev, "Chat mode activated! Type your message."]);
        return;
      case "hello":
        result = ["Hello, Welcome to my humble site! 👋"];
        break;
      case "experience":
        result = [
          "→ Worked as a freelancing programmer since 2020.",
          "→ Launched more than 5 startups in 3 different fields.",
          "→ Gained many experiences in fields like designing, blockchain and marketing."
        ];
        break;
      case "skills":
        result = [
          "🧠 Programming:",
          "• Python • C++ • HTML • JS • CSS • Solidity",
          "🎨 Designing:",
          "• Photoshop • Illustrator • Figma • Adobe Premiere",
          "📣 Marketing:",
          "• Facebook • Twitter • Google Ads"
        ];
        break;
      case "CV":
  setStaticOutput((prev) => [
    ...prev,
    "📄 CURRICULUM VITAE 📄",
    "",
    '<iframe src="CV.pdf" width="100%" height="500px" style="border:2px solid #22c55e; border-radius: 10px;"></iframe>',
  ]);
  return;

      default:
        result = [`Command not found: ${cmd}`];
    }
    
    // Only use animation for shorter outputs
    if (result.length <= 5) {
      // Queue result lines for animation
      result.forEach((line, index) => {
        setTimeout(() => {
          setQueuedLines((prev) => [...prev, line]);
        }, index * 300);
      });
    } else {
      // For longer outputs, add them directly to avoid animation issues
      setStaticOutput((prev) => [...prev, ...result]);
    }
    
    setCommand("");
  };

  const handleCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed && !selectedImage) return;

    const [baseCmd, ...args] = trimmed.split(" ");
    
    // Track command input
    if (window.trackActivity) {
      window.trackActivity("command_input", { command: trimmed });
    }

    // Allow users to exit chat mode with "exit" or "quit" or "/exit" or "/quit"
    if (chatMode && ["exit", "quit", "/exit", "/quit"].includes(trimmed.toLowerCase())) {
      setChatMode(false);
      setStaticOutput((prev) => [...prev, `$ ${trimmed}`, "Exited chat mode."]);
      setCommand("");
      clearImageSelection();
      return;
    }

    if (chatMode) {
      if (!isAdmin) {
        let imageData = null;
        
        // Upload image first if one is selected
        if (selectedImage) {
          try {
            // Show a temporary local message to indicate upload is starting
            const tempMsg = {
              id: "temp-" + new Date().getTime(),
              userName,
              user: trimmed || "Uploading image...",
              timestamp: new Date(),
              isTemp: true
            };
            
            // Add the temporary message to the chat log
            setChatLog(prev => [...prev, tempMsg]);
            
            console.log("Starting image upload process...");
            imageData = await uploadImage();
            console.log("Upload completed, result:", imageData);
            
            // Remove the temporary message if upload failed
            if (!imageData) {
              console.log("Upload failed, removing temporary message");
              setChatLog(prev => prev.filter(msg => msg.id !== tempMsg.id));
              return;
            }
          } catch (err) {
            console.error("❌ Failed to upload image:", err);
            alert("Failed to upload image. Please try again.");
            return;
          }
        }
        
        try {
          console.log("Adding message to Firestore with image data:", imageData);
          
          // Add the actual message to Firestore
          const newMsg = {
            user: trimmed,
            userName,
            timestamp: serverTimestamp()
          };
          
          // Add image data if we have it
          if (imageData) {
            if (typeof imageData === 'object' && imageData.isFirestoreImage) {
              newMsg.imageUrl = imageData.id;
              newMsg.isFirestoreImage = true;
            } else {
              newMsg.imageUrl = imageData;
            }
          }
          
          console.log("Final message object:", newMsg);
          const docRef = await addDoc(chatCollection, newMsg);
          console.log("Message added with ID:", docRef.id);
          
          try {
            if (userName !== "Abdallah") {
              // Only send email notifications for messages from regular users, not from admin
              await emailjs.send("service_vjg01x9", "template_venfmmq", {
                user_name: userName,
                message: trimmed + (imageData ? " [Image attached]" : ""),
                to_email: "abdallahelabd05@gmail.com"
              }, "iqh5uRT5wWx4PA9DC");
            }
          } catch (error) {
            console.error("❌ Email failed:", error);
          }
        } catch (err) {
          console.error("❌ Failed to write message to Firestore:", err);
          alert("Failed to send message. Please try again.");
        }
      } else {
        setStaticOutput((prev) => [...prev, "❌ Admins must reply using the panel."]);
      }
      setCommand("");
      clearImageSelection();
      return;
    }

    // Handle non-chat mode commands (direct call to executeCommand for consistent handling)
    executeCommand(trimmed);
  };

  return (
    <main className="min-h-screen bg-[#020b02] text-green-400 px-4 sm:px-6 py-8 font-mono relative overflow-hidden text-sm sm:text-base w-full bg-[radial-gradient(ellipse_at_center,_#042f1d_0%,_#010d04_100%)]">
      <div className="bg-black border border-green-700 rounded-lg p-4 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto shadow-2xl shadow-green-900/50 overflow-x-hidden">
      <section className="w-full text-base sm:text-lg md:text-xl relative z-10 px-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {booting && (
            <div className="text-green-500 mb-4 font-mono">
              <AnimatedLine text="[booting terminal session...💻]" onComplete={() => setBooting(false)} />
            </div>
          )}
          <div className="space-y-3">
            {/* Terminal Output Panel with info about Abdallah */}
            <div className="bg-black/40 border border-green-700 p-5 rounded-xl mb-4 shadow-inner shadow-green-800/20 overflow-x-auto">
              <pre className="text-green-300 mb-2 text-center sm:text-left text-base sm:text-lg font-bold">Abdallah Elabd 💚</pre>
              <pre className="text-green-300">Twitter: @abdallahelabd05</pre>
            </div>

            {/* Terminal Command Output with integrated input */}
            <div className="bg-black/40 border border-green-700 p-5 rounded-xl mb-6 shadow-inner shadow-green-800/20 overflow-x-auto max-h-[40vh]">
              {!chatMode && (
                <>
                  {staticOutput.map((line, idx) => {
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(line);
  return isHtml ? (
    <div
      key={`static-html-${idx}`}
      className="text-green-300 my-2"
      dangerouslySetInnerHTML={{ __html: line }}
    />
  ) : (
    <pre key={`static-${idx}`} className="whitespace-pre-wrap break-words text-green-300">{line}</pre>
  );
})}

                  {animatedOutput.map((line, idx) => (
                    <AnimatedLine
                      key={`animated-${idx}`}
                      text={line}
                      onComplete={(line) => {
                        setStaticOutput((prev) => [...prev, line]);
                        setAnimatedOutput([]);
                        isAnimating.current = false;
                      }}
                    />
                  ))}
                  
                  {/* Command input is always inside the terminal */}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-green-500">$</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCommand()}
                      className="bg-transparent outline-none text-green-400 placeholder-green-600 w-full pr-4"
                      placeholder={animatedOutput.length > 0 ? "waiting for output to finish..." : "type a command..."}
                      title="Enter a terminal-style command"
                      disabled={animatedOutput.length > 0}
                      autoFocus
                    />
                  </div>
                </>
              )}
              {chatMode && (
                <p className="text-green-300 mb-3">
                  <span className="text-yellow-300 font-bold">Chat mode active.</span> Type a message below to chat with Abdallah. Type 'exit' to return to command mode.
                </p>
              )}
            </div>
            
            {chatMode && (
              <div className="bg-black/30 border border-green-600 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-green-400 font-bold text-lg">💬 Chat Mode</p>
                  <button 
                    onClick={() => {
                      setChatMode(false);
                      setStaticOutput((prev) => [...prev, "Exited chat mode."]);
                      clearImageSelection();
                    }}
                    className="text-white hover:text-red-200 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-full flex items-center gap-2 font-bold shadow-lg transition-all duration-200"
                  >
                    <span>Exit Chat</span> ✕
                  </button>
                </div>
                
                {/* Chat messages display */}
                <div className="mb-4 max-h-[50vh] overflow-y-auto">
                  {chatLog
                    .filter(log => isAdmin || log.userName === userName || log.recipient === userName)
                    .map((log, idx) => (
                      <div key={log.id} className={`whitespace-pre-wrap break-words p-3 rounded-xl max-w-[80%] mb-2 ${log.userName === "Abdallah" ? "ml-auto bg-green-800 text-right" : "bg-green-900/20 text-left"}`}>
                        <p className="font-semibold">
                          <span className={`${log.userName === "Abdallah" ? "text-yellow-400" : "text-green-100"}`}>
                            {log.userName === "Abdallah" ? "🫅 Abdallah" : `👤 ${log.userName === userName ? "You" : log.userName}`}:
                          </span>
                          <span className="text-white ml-1">{log.user}</span>
                          <span className="text-xs text-green-400 ml-2">({log.timestamp?.toDate && new Date(log.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })})</span>
                          {log.reaction && (
                            <motion.span
                              key={`${log.id}-${log.reaction}`}
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1.1, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                              whileHover={{ scale: 1.2 }}
                              title={`Reaction: ${log.reaction}`}
                              className="ml-2 bg-green-800 px-2 py-1 rounded-full text-white text-sm shadow-md inline-block align-middle"
                            >
                              {log.reaction}
                            </motion.span>
                          )}
                          {log.userName === userName && log.seenByAdmin && (
                            <span className="text-xs text-green-500 ml-2">✓✓ Seen</span>
                          )}
                          {log.userName === userName && !log.seenByAdmin && (
                            <span className="text-xs text-gray-400 ml-2">✓ Sent</span>
                          )}
                        </p>
                        {/* Display attached image if any */}
                        {log.imageUrl && (
                          <div className={`mt-2 ${log.userName === "Abdallah" ? "ml-auto" : "mr-auto"}`}>
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              {log.isFirestoreImage ? (
                                // For images stored in Firestore
                                <FirestoreImage 
                                  imageId={log.imageUrl}
                                  className="rounded-lg border-2 border-green-600 max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                                />
                              ) : (
                                // For images stored in Firebase Storage
                                <img 
                                  src={log.imageUrl} 
                                  alt="Attached" 
                                  className="rounded-lg border-2 border-green-600 max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(log.imageUrl, '_blank')}
                                />
                              )}
                            </motion.div>
                          </div>
                        )}
                        
                        {/* Only show reaction button for messages from other users, not the user's own messages,
                          and hide the button if the user has already reacted to the message */}
                        {log.userName !== userName && !log.reaction && (
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: 1.1 }}
                            onClick={() => {
                              const el = document.getElementById(`react-${log.id}`);
                              if (el) {
                                // Toggle the reaction menu
                                if (el.classList.contains("hidden")) {
                                  el.classList.remove("hidden");
                                  el.classList.add("flex");
                                } else {
                                  el.classList.add("hidden");
                                  el.classList.remove("flex");
                                }
                              }
                            }}
                            className="ml-2 text-xs bg-green-700 text-white px-2 py-1 rounded-full hover:shadow-md"
                            title="React"
                          >
                            👍
                          </motion.button>
                        )}
                        
                        {/* Show reaction controls if user has already reacted */}
                        {log.userName !== userName && log.reaction && (
                          <div className="flex gap-2 mt-1">
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => {
                                const el = document.getElementById(`react-${log.id}`);
                                if (el) {
                                  // Toggle the reaction menu
                                  if (el.classList.contains("hidden")) {
                                    el.classList.remove("hidden");
                                    el.classList.add("flex");
                                  } else {
                                    el.classList.add("hidden");
                                    el.classList.remove("flex");
                                  }
                                }
                              }}
                              className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full hover:shadow-md"
                              title="Change reaction"
                            >
                              Change
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => handleReaction(log, log.reaction, setChatLog)}
                              className="text-xs bg-red-900/70 text-red-300 px-2 py-1 rounded-full hover:shadow-md hover:bg-red-900"
                              title="Remove reaction"
                            >
                              Remove
                            </motion.button>
                          </div>
                        )}
                        
                        <motion.div
                          id={`react-${log.id}`}
                          className="hidden gap-2 mt-1"
                        >
                          {["👍", "😂", "❤️", "🔥", "👀"].map((emoji) => (
                            <motion.button
                              key={emoji}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 300 }}
                              onClick={() => {
                                handleReaction(log, emoji, setChatLog);
                                const el = document.getElementById(`react-${log.id}`);
                                if (el) {
                                  el.classList.add("hidden");
                                  el.classList.remove("flex");
                                }
                              }}
                              className={`text-sm hover:bg-green-700 px-2 py-1 rounded-full transition-all ${log.reaction === emoji ? 'bg-green-700 shadow-md' : 'bg-green-900/30'}`}
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </motion.button>
                          ))}
                          {log.reaction && (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => {
                                handleReaction(log, log.reaction, setChatLog);
                                const el = document.getElementById(`react-${log.id}`);
                                if (el) {
                                  el.classList.add("hidden");
                                  el.classList.remove("flex");
                                }
                              }}
                              className="text-xs text-red-400 hover:text-red-600 bg-black/30 px-2 py-1 rounded-full"
                              title="Remove reaction"
                            >
                              Remove
                            </motion.button>
                          )}
                        </motion.div>
                      </div>
                    ))}
                </div>

                {/* Image preview section */}
                {imagePreview && (
                  <div className="mb-4 p-2 border border-green-500 rounded-lg bg-black/40">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-green-300 font-bold">📸 Image attachment</span>
                      <button 
                        onClick={clearImageSelection}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ✕ Remove
                      </button>
                    </div>
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-40 max-w-full object-contain rounded-lg border border-green-700" 
                    />
                    {uploading && (
                      <div className="mt-2">
                        <div className="w-full bg-green-900/30 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-green-500 h-full transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-green-400 mt-1 text-right">{uploadProgress}% uploaded</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Integrated input in chat box with image upload button */}
                <div className="bg-black/40 border border-green-700 p-3 rounded-xl shadow-inner shadow-green-800/20">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">💬</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCommand()}
                      className="bg-transparent outline-none text-green-400 placeholder-green-600 w-full pr-4"
                      placeholder={uploading ? "Uploading image..." : "Type your message or 'exit' to quit chat mode..."}
                      title="Enter your chat message"
                      disabled={uploading}
                      autoFocus
                    />
                    
                    {/* Image attachment button */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || !!selectedImage}
                      className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1
                        ${uploading || selectedImage 
                          ? 'bg-green-900 text-green-700 cursor-not-allowed' 
                          : 'bg-green-700 hover:bg-green-600 text-white cursor-pointer'}`}
                      title="Attach image"
                    >
                      <span>📸</span>
                    </button>
                    
                    <button
                      onClick={() => handleCommand()}
                      disabled={(!command.trim() && !selectedImage) || uploading}
                      className={`px-3 py-1 rounded-full text-sm font-bold
                        ${(!command.trim() && !selectedImage) || uploading 
                          ? 'bg-green-900 text-green-700 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'}`}
                    >
                      Send
                    </button>
                  </div>
                </div>
                <div ref={outputRef} />
              </div>
            )}
          </div>

          <PinnedCommands setCommand={setCommand} inputRef={inputRef} executeCommand={executeCommand} />
        </motion.div>
      </section>
      {isAdmin && (
        <div className="fixed bottom-0 sm:top-4 sm:right-4 left-0 sm:left-auto bg-black text-green-200 p-4 sm:rounded-lg shadow-lg w-full sm:w-[22rem] max-h-[60vh] overflow-y-auto z-50">
          <button
            className="sm:hidden block mb-2 text-green-400 underline"
            onClick={() => setAdminPanelOpen(!adminPanelOpen)}
          >
            {adminPanelOpen ? "Hide Admin Panel" : "Show Admin Panel"}
          </button>
          {(adminPanelOpen || window.innerWidth >= 640) && (
            <div className="flex flex-col h-full">
              <h2 className="font-bold text-lg mb-2">Admin Panel</h2>
              <p className="mb-3 text-sm">Type <code>logout</code> to exit admin mode.</p>

              <div className="flex-1 overflow-y-auto space-y-4 mt-3">
                {Object.entries(
                  chatLog.reduce((acc, msg) => {
                    const otherUser = msg.userName === "Abdallah" ? msg.recipient : msg.userName;
                    if (!acc[otherUser]) acc[otherUser] = [];
                    acc[otherUser].push(msg);
                    return acc;
                  }, {})
                ).map(([participant, messages]) => (
                  <div key={participant} className={`border border-green-700 rounded-xl p-3 bg-black/70 backdrop-blur-md flex flex-col ${messages.some(m => !m.seenByAdmin && m.userName !== 'Abdallah') ? 'border-yellow-400 shadow-yellow-500 shadow-md' : ''}`}>
                    <h4 className="font-bold text-green-400 mb-3 text-lg">👥 Chat with {participant}</h4>

                    <button
                      className="ml-auto mb-2 text-xs text-red-400 hover:text-red-600 underline"
                      onClick={async () => {
                        const confirmClear = window.confirm(`Clear conversation with ${participant}?`);
                        if (!confirmClear) return;
                        const idsToDelete = messages.map((m) => m.id);
                        for (const id of idsToDelete) {
                          await deleteDoc(doc(db, "chat", id));
                        }
                      }}
                    >
                      🗑 Clear conversation
                    </button>

                    <ul className="space-y-2 text-sm">
                      {messages.map((msg, index) => (
                        <li
                          key={index}
                          className={`rounded-xl p-3 shadow-inner max-w-[80%] ${msg.userName === "Abdallah" ? "ml-auto bg-green-800 text-right" : "bg-green-900/20 text-left"}`}
                        >
                          <p className="text-white">
                            <span className={msg.userName === "Abdallah" ? "text-yellow-400 font-bold" : "text-green-100"}>
                              {msg.userName === "Abdallah" ? "🫅 Abdallah: " : ""}
                            </span>
                            {msg.user} 
                            {msg.reaction && 
                              <span className='ml-2 bg-green-700 px-2 py-1 rounded-full'>{msg.reaction}</span>
                            }
                          </p>
                          
                          {/* Display image in admin panel */}
                          {msg.imageUrl && (
                            <div className="mt-2">
                              {msg.isFirestoreImage ? (
                                // For images stored in Firestore
                                <FirestoreImage 
                                  imageId={msg.imageUrl}
                                  className="rounded-lg border border-green-600 max-w-full max-h-32 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                                />
                              ) : (
                                // For images stored in Firebase Storage
                                <img 
                                  src={msg.imageUrl} 
                                  alt="Attached" 
                                  className="rounded-lg border border-green-600 max-w-full max-h-32 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(msg.imageUrl, '_blank')}
                                />
                              )}
                            </div>
                          )}
                          
                          <div className="flex gap-2 mt-1">
                            {["👍", "😂", "❤️", "🔥", "👀"].map((emoji) => (
                              <motion.button
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300 }}
                                key={emoji}
                                onClick={() => handleReaction(msg, emoji, setChatLog)}
                                className={`text-sm hover:bg-green-700 px-2 py-1 rounded-full transition-all ${msg.reaction === emoji ? 'bg-green-700 shadow-md' : 'bg-green-900/30'}`}
                                title={`React with ${emoji}`}
                              >
                                {emoji}
                              </motion.button>
                            ))}
                          </div>
                          {isAdmin && (
                            <button
                              className="text-xs text-red-400 mt-1 hover:text-red-600"
                              onClick={async () => {
                                const confirmDelete = window.confirm("Delete this message?");
                                if (confirmDelete) {
                                  await deleteDoc(doc(db, 'chat', msg.id));
                                }
                              }}
                            >
                              🗑 Delete
                            </button>
                          )}
                          <span className="block text-xs text-green-500 mt-1">{msg.timestamp?.toDate && new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                          {msg.userName === "Abdallah" && (
                            <span className="block text-[10px] text-green-400 mt-0.5">
                              {msg.seenByUser ? `✓✓ Seen ${msg.seenTime ? 'at ' + msg.seenTime : ''}` : "✓ Sent"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3">
                      {/* Admin image upload section */}
                      <div className="flex items-center gap-2 mb-2">
                        <label className="flex-1 text-xs text-green-400">
                          <span className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded-full cursor-pointer inline-block mb-1">
                            📸 Send image
                          </span>
                          <input 
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleAdminImageUpload(e, participant)}
                          />
                        </label>
                      </div>

                      <form
                        className="flex gap-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const input = e.target.elements[`reply-${participant}`];
                          const message = input.value.trim();
                          if (!message) return;
                          const time = new Date().toLocaleTimeString();
                          await addDoc(chatCollection, {
                            user: message,
                            recipient: participant,
                            userName: "Abdallah",
                            time,
                            timestamp: serverTimestamp(),
                            seenByUser: false
                          });
                          input.value = "";
                        }}
                      >
                        <input
                          type="text"
                          name={`reply-${participant}`}
                          placeholder={`Reply to ${participant}...`}
                          className="flex-1 bg-black border border-green-500 rounded px-3 py-1 text-green-200 placeholder-green-500"
                        />
                        <button
                          type="submit"
                          className="bg-green-700 px-4 py-1 rounded text-white hover:bg-green-600"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </main>
  );
}

const AnimatedLine = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!text) return;
    let i = 0;
    const stripped = text.replace(/<[^>]+>/g, "");
    const chars = [...stripped];
    const interval = setInterval(() => {
      if (i < chars.length) {
        setDisplayedText((prev) => prev + chars[i]);
        i++;
      } else {
        clearInterval(interval);
        if (onComplete && typeof text === "string") {
          setTimeout(() => onComplete(text + ""), 0);
        }
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text]);

  const isHtml = /<[^>]+>/.test(text);
  return isHtml ? (
    <pre dangerouslySetInnerHTML={{ __html: text }} />
  ) : (
    <pre className="whitespace-pre-wrap break-words">{displayedText}<span className="animate-pulse">█</span></pre>
  );
};
