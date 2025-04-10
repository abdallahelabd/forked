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
  deleteDoc
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

function PinnedCommands({ setCommand, inputRef }) {
  const pinnedCommands = ["hello", "experience", "skills", "chat"];
  return (
    <div className="mt-10 border border-green-700 p-4 rounded-xl bg-green-900/10 backdrop-blur-md">
      <p className="text-green-300 text-xl mb-3 font-bold underline">Pinned Commands</p>
      <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
        {pinnedCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              setCommand(cmd);
              inputRef.current?.focus();
            }}
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

  useEffect(() => {
    if (queuedLines.length > 0 && animatedOutput.length === 0) {
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
      // Create a unique filename with only safe characters
      const timestamp = new Date().getTime();
      const safeFileName = selectedImage.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filename = `${userName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${safeFileName}`;
      const fileRef = storageRef(storage, `chat_images/${filename}`);
      
      console.log("Starting upload to", `chat_images/${filename}`);
      
      // Create file metadata including the content type
      const metadata = {
        contentType: selectedImage.type,
      };
      
      // Upload the file with metadata
      const uploadTask = uploadBytesResumable(fileRef, selectedImage, metadata);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            setUploadProgress(Math.round(progress));
            
            switch (snapshot.state) {
              case 'paused':
                console.log('Upload is paused');
                break;
              case 'running':
                console.log('Upload is running');
                break;
              default:
                break;
            }
          },
          (error) => {
            // Handle unsuccessful uploads
            console.error('Upload error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            setUploading(false);
            
            let errorMessage = 'Upload failed';
            switch (error.code) {
              case 'storage/unauthorized':
                errorMessage = 'User does not have permission to access the storage';
                break;
              case 'storage/canceled':
                errorMessage = 'Upload was canceled';
                break;
              case 'storage/unknown':
                errorMessage = 'Unknown error occurred';
                break;
              default:
                errorMessage = `Error: ${error.message}`;
            }
            
            alert(errorMessage);
            reject(error);
          },
          () => {
            // Handle successful uploads
            console.log('Upload completed successfully');
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
              console.log('File available at', downloadURL);
              setUploading(false);
              setUploadProgress(100);
              resolve(downloadURL);
            }).catch((error) => {
              console.error('Error getting download URL:', error);
              setUploading(false);
              alert('Error getting download URL: ' + error.message);
              reject(error);
            });
          }
        );
      });
    } catch (error) {
      console.error('Error setting up upload:', error);
      setUploading(false);
      alert('Error setting up upload: ' + error.message);
      return null;
    }
  };

  const handleCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed && !selectedImage) return;

    const [baseCmd, ...args] = trimmed.split(" ");

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
        let imageUrl = null;
        
        // Upload image first if one is selected
        if (selectedImage) {
          try {
            // Show a temporary local message to indicate upload is starting
            const tempMsg = {
              id: "temp-" + new Date().getTime(),
              userName,
              user: trimmed,
              timestamp: new Date(),
              isTemp: true
            };
            
            // Add the temporary message to the chat log
            setChatLog(prev => [...prev, tempMsg]);
            
            imageUrl = await uploadImage();
            
            // Remove the temporary message if upload failed
            if (!imageUrl) {
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
          // Add the actual message to Firestore
          const newMsg = {
            user: trimmed,
            userName,
            timestamp: serverTimestamp(),
            imageUrl: imageUrl
          };
          
          await addDoc(chatCollection, newMsg);
          
          try {
            if (userName !== "Abdallah") {
              // Only send email notifications for messages from regular users, not from admin
              await emailjs.send("service_vjg01x9", "template_venfmmq", {
                user_name: userName,
                message: trimmed + (imageUrl ? " [Image attached]" : ""),
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

    // This condition is now handled in the section above

    let result = [];
    switch (baseCmd) {
      case "clear":
        setStaticOutput((prev) => [...prev, `$ ${command}`, "🪩 This command no longer clears global chat."]);
        setCommand("");
        return;
      case "admin":
        if (args[0] === "1234") {
          setIsAdmin(true);
          localStorage.setItem("isAdmin", "true");
          setAdminPanelOpen(true);
          setStaticOutput((prev) => [...prev, `$ ${command}`]);
        } else {
          setStaticOutput((prev) => [...prev, `$ ${command}`, "❌ Incorrect passcode."]);
        }
        setCommand("");
        return;
      case "logout":
        setIsAdmin(false);
        localStorage.removeItem("isAdmin");
        setStaticOutput((prev) => [...prev, `$ ${command}`, "🚩 Logged out of admin mode."]);
        setCommand("");
        return;
      case "chat":
        setChatMode(true);
        setStaticOutput((prev) => [...prev, `$ ${trimmed}`, "Chat mode activated! Type your message."]);
        setCommand("");
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
      default:
        result = [`Command not found: ${trimmed}`];
    }

    setStaticOutput((prev) => [...prev, `$ ${trimmed}`]);
    result.forEach((line, index) => {
      setTimeout(() => {
        setQueuedLines((prev) => [...prev, line]);
      }, index * 400);
    });
    setCommand("");
  };

  const handleAdminImageUpload = async (e, participant) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Only accept images under 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 5MB.");
      return;
    }
    
    // Create a unique filename with only safe characters
    const timestamp = new Date().getTime();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filename = `Abdallah_${timestamp}_${safeFileName}`;
    const fileRef = storageRef(storage, `chat_images/${filename}`);
    
    console.log("Starting admin upload to", `chat_images/${filename}`);
    
    // Create file metadata including the content type
    const metadata = {
      contentType: file.type,
    };
    
    // Display a temporary loading message
    const tempLoadingId = "temp-" + timestamp;
    setChatLog(prev => [...prev, { 
      id: tempLoadingId, 
      user: "Uploading image...", 
      userName: "Abdallah",
      recipient: participant,
      timestamp: new Date()
    }]);
    
    // Upload the file with metadata
    const uploadTask = uploadBytesResumable(fileRef, file, metadata);
    
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Admin upload is ' + progress + '% done');
        
        // Update the temporary message with progress
        setChatLog(prev => prev.map(msg => 
          msg.id === tempLoadingId 
            ? { ...msg, user: `Uploading image... ${Math.round(progress)}%` }
            : msg
        ));
        
        switch (snapshot.state) {
          case 'paused':
            console.log('Admin upload is paused');
            break;
          case 'running':
            console.log('Admin upload is running');
            break;
          default:
            break;
        }
      },
      (error) => {
        // Handle unsuccessful uploads
        console.error('Admin upload error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Remove the temporary message on error
        setChatLog(prev => prev.filter(msg => msg.id !== tempLoadingId));
        
        let errorMessage = 'Upload failed';
        switch (error.code) {
          case 'storage/unauthorized':
            errorMessage = 'User does not have permission to access the storage';
            break;
          case 'storage/canceled':
            errorMessage = 'Upload was canceled';
            break;
          case 'storage/unknown':
            errorMessage = 'Unknown error occurred';
            break;
          default:
            errorMessage = `Error: ${error.message}`;
        }
        
        alert(errorMessage);
      },
      () => {
        // Handle successful uploads
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          console.log('Admin file available at', downloadURL);
          
          // Remove the temporary message
          setChatLog(prev => prev.filter(msg => msg.id !== tempLoadingId));
          
          const time = new Date().toLocaleTimeString();
          
          // Add the image message to Firestore
          addDoc(chatCollection, {
            user: "",
            recipient: participant,
            userName: "Abdallah",
            time,
            timestamp: serverTimestamp(),
            seenByUser: false,
            imageUrl: downloadURL
          }).catch(error => {
            console.error("Failed to add image message to Firestore:", error);
            alert("Failed to save image message: " + error.message);
          });
        }).catch((error) => {
          console.error('Error getting admin download URL:', error);
          // Remove the temporary message on error
          setChatLog(prev => prev.filter(msg => msg.id !== tempLoadingId));
          alert('Error getting download URL: ' + error.message);
        });
      }
    );
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
                  {staticOutput.map((line, idx) => (
                    <pre key={`static-${idx}`} className="whitespace-pre-wrap break-words text-green-300">{line}</pre>
                  ))}
                  {animatedOutput.map((line, idx) => (
                    <AnimatedLine
                      key={`animated-${idx}`}
                      text={line}
                      onComplete={(line) => {
                        setStaticOutput((prev) => [...prev, line]);
                        setAnimatedOutput([]);
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
                              <img 
                                src={log.imageUrl} 
                                alt="Attached" 
                                className="rounded-lg border-2 border-green-600 max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(log.imageUrl, '_blank')}
                              />
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
                      onKeyDown={(e) => e.key === "Enter" && !uploading && handleCommand()}
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
                      onClick={handleCommand}
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

          <PinnedCommands setCommand={setCommand} inputRef={inputRef} />
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
                              <img 
                                src={msg.imageUrl} 
                                alt="Attached" 
                                className="rounded-lg border border-green-600 max-w-full max-h-32 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.imageUrl, '_blank')}
                              />
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
