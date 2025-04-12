// Tab.tsx
import {useDispatch,useSelector} from 'react-redux';
import {RootState} from 'store/store';
import { setActiveTab } from '../../store/slices/UiSlice';


export default function Tab({ label}: { label: 'direct' | 'groups' }) {
    const activeTab = useSelector((state: RootState) => state.ui.activeTab);
    const dispatch = useDispatch();
    const isActive = activeTab.toLowerCase() === label.toLowerCase();


    return (
      <button onClick={() => dispatch(setActiveTab(label.toLowerCase() as 'direct' | 'groups'))}
        className={`flex-1 py-2 text-sm font-medium text-center ${
          isActive ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'
        }`}
      >
        {label}
      </button>
    );
  }