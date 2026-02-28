import React from 'react';
import { motion } from 'framer-motion';
import './GlobalLoader.css';

export default function GlobalLoader() {
    return (
        <motion.div
            className="global-loader-container"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
        >
            <div className="cube-scene">
                <div className="tech-cube">
                    <div className="face front"></div>
                    <div className="face back"></div>
                    <div className="face right"></div>
                    <div className="face left"></div>
                    <div className="face top"></div>
                    <div className="face bottom"></div>
                </div>
                <div className="cube-shadow"></div>
            </div>

            <motion.h2
                className="loading-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.5, 1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
            >
                ACTIVATING AI CORE
            </motion.h2>

            <div className="loading-bar-container">
                <motion.div
                    className="loading-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                />
            </div>
        </motion.div>
    );
}
