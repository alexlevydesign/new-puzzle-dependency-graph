import "./Menu.css";
import { useState, useRef, useEffect } from "react";

import MenuItem from "./MenuItem";
import Button from "../Button/Button";

function Menu({ children, align = "right" }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    
    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };
    
    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isMenuOpen]);
    
    const alignClass = `menu-items-container--${align}`;
    
    return (
        <div className="menu" ref={menuRef}>
            <Button
                label="Options"
                icon="options"
                onClick={toggleMenu}
            >

            </Button>
            {isMenuOpen && (
                <ul className={`menu-items-container ${alignClass}`}>
                    {children}
                </ul>

            )}
            </div>
)};




export default Menu;