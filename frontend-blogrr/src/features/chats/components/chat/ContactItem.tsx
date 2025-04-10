interface ContactItemProps {
  name: string;
  active?: boolean;
  onClick?: () => void;
}

const ContactItem: React.FC<ContactItemProps> = ({ name, active, onClick }) => {
  return (
    <div
      className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
        active ? 'bg-blue-100 font-semibold' : ''
      }`}
      onClick={onClick}
    >
      {name}
    </div>
  );
};

export default ContactItem;