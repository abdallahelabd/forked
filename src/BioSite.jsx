/* Firebase-integrated version with real-time global chat */
import React, { useState, useEffect, useRef } from "react";
import emailjs from "emailjs-com";
import { motion } from "framer-motion";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";

const chatCollection = collection(db, "chat");

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
  const inputRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    const q = query(chatCollection, orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => doc.data());
      setChatLog(messages);
      const outputLines = messages.map(log => {
        const userLine = log.userName === "Abdallah"
          ? `<span class='text-yellow-400'>🫅 Abdallah</span>: ${log.user} (${log.time}) <span class='text-blue-400'>✓</span> <span class='text-blue-400'>✓</span>`
          : `👤 ${log.userName}: ${log.user} (${log.time}) <span class='text-blue-400'>✓</span>`;
        return userLine;
      });
      setStaticOutput(["Abdallah Elabd 💚", "Twitter: @abdallahelabd05", ...outputLines]);
    });
    return () => unsubscribe();
  }, []);

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
        await addDoc(chatCollection, newMsg);
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
        setStaticOutput((prev) => [...prev, `$ ${command}`, "🧹 This command no longer clears global chat."]);
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
        </motion.div>

        {isAdmin && (
          <div className="fixed bottom-0 sm:top-4 sm:right-4 left-0 sm:left-auto bg-green-900 text-green-200 p-4 sm:rounded-lg shadow-lg w-full sm:w-[22rem] max-h-[60vh] overflow-y-auto z-50">
            <h2 className="font-bold text-lg mb-2">Admin Panel</h2>
            <p className="mb-3 text-sm">Type <code>logout</code> to exit admin mode.</p>
            <textarea
              placeholder="Type your message as admin..."
              className="w-full bg-black border border-green-600 text-green-200 p-2 rounded mb-2 resize-none text-sm sm:text-base"
              rows={3}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const adminMessage = e.target.value.trim();
                  if (!adminMessage) return;
                  const time = new Date().toLocaleTimeString();
                  await addDoc(chatCollection, {
                    user: adminMessage,
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
            <h3 className="text-green-300 text-sm mb-2 font-bold">User Messages</h3>
            <ul className="space-y-1 text-sm">
              {chatLog.map((log, index) => (
                <li key={index} className="text-green-100 border-b border-green-700 pb-1">
                  👤 {log.userName}: {log.user} <span className="text-xs text-green-400">({log.time})</span>
                </li>
              ))}
            </ul>
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
};;
