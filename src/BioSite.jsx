// Firebase-integrated version with real-time global chat
import React, { useState, useEffect, useRef } from "react";
import emailjs from "emailjs-com";
import { motion } from "framer-motion";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCvJp9MjJ3CJGDcM1dj2U0LYBCtdc5BBmk",
  authDomain: "abdallahbio-18d4c.firebaseapp.com",
  databaseURL: "https://abdallahbio-18d4c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "abdallahbio-18d4c",
  storageBucket: "abdallahbio-18d4c.firebasestorage.app",
  messagingSenderId: "1059962976137",
  appId: "1:1059962976137:web:5e60b5af318796e4b35358",
  measurementId: "G-GYD479RY6M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const chatCollection = collection(db, "chat");

const pinnedCommands = ["hello", "experience", "skills", "chat"];

function PinnedCommands({ setCommand, inputRef }) {
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

      if (isAdmin && adminPanelOpen) {
        messages.forEach((msg) => {
          if (!msg.seenByAdmin) {
            const docRef = doc(db, "chat", msg.id);
            updateDoc(docRef, { seenByAdmin: true });
          }
        });
      }

      const outputLines = messages
        .filter(log => isAdmin || log.userName === userName || (log.userName === "Abdallah" && log.recipient === userName))
        .map(log => {
          const userLine = log.userName === "Abdallah"
            ? `<span class='text-yellow-400'>🫅 Abdallah</span>: ${log.user} (${log.time}) <span class='text-blue-400'>✓</span> <span class='text-blue-400'>✓</span>`
            : `👤 ${log.userName === userName ? "You" : log.userName}: ${log.user} (${log.time}) <span class='text-blue-400 transition-opacity duration-500'>✓</span>${log.seenByAdmin ? " <span class='text-blue-400 transition-opacity duration-500 animate-pulse'>✓</span>" : ""}`;
          return userLine;
        });
      setStaticOutput(["Abdallah Elabd 💚", "Twitter: @abdallahelabd05", ...outputLines]);
    });
    return () => unsubscribe();
  }, [isAdmin, userName]);

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
          const docRef = await addDoc(chatCollection, newMsg);
          console.log("✅ Message written with ID:", docRef.id);
        } catch (err) {
          console.error("❌ Failed to write message to Firestore:", err);
        }
        try {
          await emailjs.send("service_2fdtfyg", "template_btw21b8", {
            user_name: userName,
            message: trimmed
          }, "vhPVKbLsc89CisiWl");
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
          setStaticOutput((prev) => [...prev, `$ ${command}`, "✅ Admin access granted."]);
        } else {
          setStaticOutput((prev) => [...prev, `$ ${command}`, "❌ Incorrect passcode."]);
        }
        setCommand("");
        return;
      case "logout":
        setIsAdmin(false);
        localStorage.removeItem("isAdmin");
        setStaticOutput((prev) => [...prev, `$ ${command}`, "🚪 Logged out of admin mode."]);
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

        {isAdmin && (
          <div className="fixed bottom-0 sm:top-4 sm:right-4 left-0 sm:left-auto bg-white text-black rounded-lg shadow-lg w-full sm:w-[22rem] max-h-[60vh] overflow-y-auto z-50 border border-green-700">
            <button
              className="sm:hidden block mb-2 p-2 text-green-700 font-semibold"
              onClick={() => setAdminPanelOpen(!adminPanelOpen)}
            >
              {adminPanelOpen ? "Hide Admin Panel" : "Show Admin Panel"}
            </button>
            {(adminPanelOpen || window.innerWidth >= 640) && (
              <div className="flex flex-col h-full p-4">
                <h2 className="font-bold text-lg mb-2 text-green-800">Admin Panel</h2>
                <p className="mb-3 text-sm text-gray-600">Type <code>logout</code> to exit admin mode.</p>
                <textarea
                  placeholder="Type your message as admin..."
                  className="w-full bg-gray-100 border border-green-600 text-black p-2 rounded mb-2 resize-none text-sm sm:text-base"
                  rows={3}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const adminMessage = e.target.value.trim();
                      if (!adminMessage) return;
                      const time = new Date().toLocaleTimeString();
                      await addDoc(chatCollection, {
                        user: adminMessage,
                        recipient: userName,
                        userName: "Abdallah",
                        time,
                        timestamp: serverTimestamp()
                      });
                      e.target.value = "";

                      try {
                        await emailjs.send("service_2fdtfyg", "template_btw21b8", {
                          user_name: "Abdallah",
                          message: adminMessage,
                          to_email: "abdallahelabd05@gmail.com"
                        }, "vhPVKbLsc89CisiWl");
                      } catch (error) {
                        console.error("Email failed:", error);
                      }
                    }
                  }}
                />
                <div className="bg-gray-100 rounded p-3 flex-1 overflow-y-auto">
                  <h3 className="text-green-700 text-sm mb-2 font-bold">User Messages</h3>
                  <ul className="space-y-2 text-sm">
                    {chatLog.map((log, index) => (
                      <li key={index} className="p-2 bg-white border border-gray-300 rounded shadow-sm">
                        <span className="font-semibold text-green-800">👤 {log.userName}</span>
                        <span className="block text-gray-800 mt-1">{log.user}</span>
                        <span className="block text-xs text-gray-500 mt-1">{log.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
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
