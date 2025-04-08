// Firebase-integrated version with real-time global chat

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const chatCollection = collection(db, "chat");

function PinnedCommands({ setCommand, inputRef }) {
  const pinnedCommands = ["hello", "experience", "skills", "chat"];
  return (
    <div className="mt-10 border border-green-700 p-4 rounded-xl bg-green-900/10 backdrop-blur-md">
      <p className="text-green-300 text-xl mb-3 font-bold underline">Pinned Commands</p>
      <div className="flex flex-wrap gap-4">
        {pinnedCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              setCommand(cmd);
              inputRef.current?.focus();
            }}
            className="px-4 py-2 bg-green-500 text-black font-semibold rounded-2xl shadow-md hover:bg-green-400 hover:scale-105 transition-all duration-200"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BioSite() {
  const [command, setCommand] = useState("");
  const [staticOutput, setStaticOutput] = useState(["Abdallah Elabd 💚", "Twitter: @abdallahelabd05"]);
  const [animatedOutput, setAnimatedOutput] = useState([]);
  const [queuedLines, setQueuedLines] = useState([]);
  const [chatMode, setChatMode] = useState(false);
  const [chatLog, setChatLog] = useState([]);
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

  useEffect(() => {
    const q = query(chatCollection, orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatLog(messages);

      if (!isAdmin) {
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
        messages
          .filter((msg) => !msg.seenByAdmin && msg.userName !== "Abdallah")
          .forEach((msg) => {
            const docRef = doc(db, "chat", msg.id);
            updateDoc(docRef, { seenByAdmin: true });
          });
      }

      const outputLines = messages
        .filter(log => isAdmin || log.userName === userName || log.recipient === userName)
        .map(log => {
          const reaction = log.reaction ? `<span class='inline-block ml-2 bg-green-800 px-2 py-1 rounded-full text-white text-xs animate-bounce shadow-md'>${log.reaction}</span>` : "";
          const userLine = log.userName === "Abdallah"
            ? `🫅 Abdallah: ${log.user} (${log.time})${reaction}`
            : `👤 ${log.userName === userName ? "You" : log.userName}: ${log.user} (${new Date(log.timestamp?.toDate?.()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}) <span class='text-blue-400'>✓</span>${log.seenByAdmin ? " <span class='text-blue-400'>✓</span>" : ""}${reaction}`;
          return userLine;
        });

      setStaticOutput(["Abdallah Elabd 💚", "Twitter: @abdallahelabd05", ...outputLines]);
    });

    return () => unsubscribe();
  }, [isAdmin, userName, adminPanelOpen]);

  useEffect(() => {
    outputRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staticOutput, animatedOutput]);

  useEffect(() => {
    if (queuedLines.length > 0 && animatedOutput.length === 0) {
      const [next, ...rest] = queuedLines;
      setAnimatedOutput([next]);
      setQueuedLines(rest);
    }
  }, [queuedLines, animatedOutput]);

  const handleCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed) return;

    const [baseCmd, ...args] = trimmed.split(" ");

    if (chatMode && trimmed !== "exit") {
      if (!isAdmin) {
        const time = new Date().toLocaleTimeString();
        const newMsg = {
          user: trimmed,
          userName,
          time,
          timestamp: serverTimestamp()
        };
        try {
          await addDoc(chatCollection, newMsg);
        } catch (err) {
          console.error("❌ Failed to write message to Firestore:", err);
        }
        try {
          if (userName !== "Abdallah") {
            await emailjs.send("service_2fdtfyg", "template_btw21b8", {
              user_name: userName,
              message: trimmed,
              to_email: "abdallahelabd05@gmail.com"
            }, "vhPVKbLsc89CisiWl");
          }
        } catch (error) {
          console.error("❌ Email failed:", error);
        }
      } else {
        setStaticOutput((prev) => [...prev, "❌ Admins must reply using the panel."]);
      }
      setCommand("");
      return;
    }

    if (chatMode && trimmed === "exit") {
      setChatMode(false);
      setStaticOutput((prev) => [...prev, `$ ${trimmed}`, "Exited chat mode."]);
      setCommand("");
      return;
    }

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
    setQueuedLines(result);
    setCommand("");
  };

  return (
    <main className="min-h-screen bg-black text-green-400 px-4 sm:px-6 py-16 font-mono relative overflow-hidden">
      <section className="max-w-6xl mx-auto text-base sm:text-lg md:text-xl relative z-10 px-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <div className="space-y-3">
            {staticOutput.map((line, idx) => (
              <pre key={`static-${idx}`} className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: line }} />
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
            <div ref={outputRef} />
          </div>

          <div className="mt-6 flex items-center gap-2">
            <span className="text-green-500">$</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCommand()}
              className="bg-transparent outline-none text-green-400 placeholder-green-600 w-full pr-4"
              placeholder="type a command..."
              autoFocus
            />
          </div>

          <PinnedCommands setCommand={setCommand} inputRef={inputRef} />
        </motion.div>
      </section>
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
