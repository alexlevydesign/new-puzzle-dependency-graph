import "./MenuItem.css";

function MenuItem({label, icon, onClick}) {
    
    return (
        <li className="menu-item" onClick={onClick}>
            <p>{label}</p>
            <img src={`/icons/${icon}.svg`}/>
        </li>
    
    );

};




export default MenuItem