import "./Button.css"

function Button({ type, label, icon, onClick, variant = "primary", disabled = false, active = false, title }) {
    const variantClass = `button--${variant}`;
    const activeClass = active ? 'button--active' : '';
    
    return (
        <button 
            className={`button ${variantClass} ${activeClass} ${type}`} 
            onClick={onClick}
            disabled={disabled}
            title={title}
        >
            {label && <span className="button-label">{label}</span>}
            {icon && <img src={`/icons/${icon}.svg`} alt={label || ""} />}
        </button>
    );
}

export default Button;