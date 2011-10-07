
default:
	git archive HEAD --format zip -0 -o csseditfb.xpi
	
install:
	firefox `pwd`/csseditfb.xpi 