import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import MainLayout from '../../../layouts/MainLayout';
import BlogsList from '../components/BlogsList';
import { setView } from '../store/blogSlice';
import { AppDispatch } from 'store/store';
import WelcomeBanner from '../components/WelcomeBanner';

const MyBlogs = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(setView('my'));
  }, [dispatch]);

  return (
    <MainLayout>
      <WelcomeBanner username={localStorage.getItem('username') || ''} />
      <BlogsList view="my" />
    </MainLayout>
  );
};

export default MyBlogs;
