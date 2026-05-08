import "./Menu.css";
import { useState } from "react";

import MenuItem from "./MenuItem";
import Button from "../Button/Button";

function Menu({ children }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };
    
    return (
        <div className="menu">
            <Button
                label="Options"
                icon="options"
                onClick={toggleMenu}
            >

            </Button>
            {isMenuOpen && (
                <ul className="menu-items-container">
                    {children}
                </ul>

            )}
            </div>
)};




export default Menu;