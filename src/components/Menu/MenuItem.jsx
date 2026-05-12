import "./MenuItem.css";

function MenuItem({label, icon, onClick, type}) {
    
    return (
        <li className={`menu-item ${type}`} onClick={onClick}>
            <p>{label}</p>
            <img src={`/icons/${icon}.svg`}/>
        </li>
    
    );

};




export default MenuItem