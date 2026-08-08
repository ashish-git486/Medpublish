import HeroSection from '../components/home/HeroSection.jsx'
import SearchResearch from '../components/home/SearchResearch.jsx'
import FeaturedResearch from '../components/home/FeaturedResearch.jsx'
import BrowseBySubject from '../components/home/BrowseBySubject.jsx'
import WhyMedPublish from '../components/home/WhyMedPublish.jsx'
import ContributorCTA from '../components/home/ContributorCTA.jsx'
import LatestResearch from '../components/home/LatestResearch.jsx'

function HomePage() {
  return (
    <div>
      <HeroSection />
      <SearchResearch />
      <FeaturedResearch />
      <BrowseBySubject />
      <WhyMedPublish />
      <ContributorCTA />
      <LatestResearch />
    </div>
  )
}

export default HomePage
