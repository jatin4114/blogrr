
interface ContactItemProps {
  name: string;
  active?: boolean;
  onClick?: () => void;
  unreadCount?: number;
}


const ContactItem: React.FC<ContactItemProps> = ({ name, active, onClick, unreadCount }) => {
  return (
    <div
      className={`p-3 rounded cursor-pointer hover:bg-gray-100 ${
        active ? 'bg-blue-100 font-semibold' : ''
      } flex items-center justify-between`}
      onClick={onClick}
    >
      <span>{name}</span>
      {unreadCount && unreadCount > 0 && (
        <span className="ml-2 w-3 h-3 rounded-full bg-green-500 inline-block" title={`${unreadCount} unread messages`} />
      )}
    </div>
  );
};

export default ContactItem;