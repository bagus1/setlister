




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts








% this causes the variables to be defined...












% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "Chega De Saudade" }
			\fill-line { \large \smaller \bold \larger "No More Blues" }
			\fill-line {
				"Lyrics by Vinicius DeMoraes, John Hendricks, Jessie Cavanaugh"
				"Music by Antonio Carlos Jobim"
			}
			\fill-line {
				"Bossa Nova"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startChords
	\startSong

	\myMark "A"
	\startPart
	d1:m7 | d2.:m7 d4:m7/c | b1:m7.5- | e:7.9- | \myEndLine
	e:m7.5- | a:7.9- | d:m | e2:m7.5- a:7.9- | \myEndLine
	d2:m d:m/c | b:m7.5- e:7 | a1*2:m | \myEndLine
	bes:maj7 | e1:m7.5- | a:7.9- | \myEndLine
	\endPart

	\myMark "A'"
	\startPart
	d1:m7 | d2.:m7 d4:m7/c | b1:m7.5- | e:7.9- | \myEndLine
	e:m7.5- | a:7.9- | d:m | d:7 | \myEndLine
	g2:m g:m/f | a:7/e a:7 | d1:m | d:m/c | \myEndLine
	b2:m7.5- e:7.9- | a1:7.9- | d:m | e2:m7 a:7.5+ | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	d1:maj7 | dis:dim7 | e1*2:m7 | \myEndLine
	a:7 | d1:dim7 | d:maj7 | \myEndLine
	fis:m7 | f:dim7 | e1*2:m7 | \myEndLine
	e:7 | e1:m7.5- | a:7.9- | \myEndLine
	\endPart

	\myMark "A''"
	\startPart
	d2:maj7 d:m7/cis | b1:m7 | e1*2:7 | \myEndLine
	fis1 | fis:7 | b2:m7 bes:m7 | a2:m7 d:7.9- | \myEndLine
	g1:maj7 | c:9 | fis:m7 | b2:7 b:7.5+ | \myEndLine
	e1:7 | e2..:m7/a a8:7/g | fis1:m7 | b:7.9- | \myEndLine
	e:7 | e2:m7/a e8:m7/a a4.:7 | d1*2 | \myEndLine
	\endPart

	\endSong
	\endChords
}


}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Presto" 4 = 200
	\time 2/2
	\key f \major

	% part "A"
	f'2 a, | d2. f4 | e2 b! | d2. e4 |
	f2 bes, | cis f4 e~ | e8 d4 f8~ f e d4 | a1 |
	f'2 a, | b!2. d4 | c2 e~ | e4 e d c |
	c2 bes~ | bes4 f' e d | d cis e8 cis4 bes8~ | bes2. r4 |

	% part "A'"
	f'2 a, | d2. f4 | e2 b! | d2. e4 |
	f2 bes, | cis f4 e~ | e8 d4 cis8~ cis d ees4~ | ees d fis a |
	g2 bes | cis,~ cis8 a'4 g8~ | g f4 a8~ a g f4 | e4. d8 cis4 d |
	f8 d4 b!8~ b d4 f8~ | f cis4 bes8~ bes f'4 d8~ | d1 | r |

	\key d \major

	% part "B"
	fis2. a4 | g2. dis4 | fis e dis8 e4 b'8~ | b4 g e b |
	d4. cis8~ cis2~ | cis4 e cis8 a4 b8~ | b1 | a2. cis4 |
	e d cis8 d4 f8~ | f4 gis cis8 b4 a8~ | a g4 b,8~ b2~ | b4 b cis8 d4 fis8~ |
	fis4 e d8 b4 gis8~ | gis4 b cis8 e4 d8~ | d2~ d4. cis8~ | cis1 |

	% part "A''"
	fis2 a, | b2. fis'4 | e2 b | d2. e4 |
	fis2 ais, | cis2. fis4 | e8 d4 cis8~ cis d4 e8~ | e d4 fis8~ fis4 b |
	a8 fis4 d8~ d4. b8 | a' f!4 d8~ d4 bes | a'8 e4 cis8~ cis4 a | gis'4 b g! b |
	fis8 d4 b8 d4 fis~ | fis d b8 d4 fis8~ | fis2~ fis8 fis g a | b4 a g fis |
	d8 b4 d8 fis4 d~ | d b d8 fis4 d8~ | d1~ | d2. r4 |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	No More Blues,
	I'm goin' back home.
	No, No More Blues,
	I prom -- ise no __ more to roam.
	Home is where the heart is, __
	the fun -- ny part is __
	my heart's been right there all a -- long. __

	% part "A'"
	No more tears and no more sighs,
	and no more fears, I'll say __ no more __ good -- byes. __
	If tra -- vel beck -- ons me __
	I swear __ I'm gon -- __ na re -- fuse,
	I'm gon -- na set -- tle down __
	and there'll __ be No __ More Blues. __

	% part "B"
	Ev -- 'ry day while I am far a -- way __
	my thoughts turn home -- ward, __
	for -- ev -- er home -- __ ward.
	I trav -- elled 'round the world __
	in search of hap -- pi -- ness, __
	but all my hap -- pi -- ness I found __
	was in my home -- __ town. __

	% part "A''"
	No More Blues, I'm goin' back home.
	No, no more dues, I'm through with all __
	my wan -- __ drin', now __ I'll set -- tle down __ and live my life __
	and build a home __ and find a wife,
	when we set -- tle down there'll __ be No More Blues __
	noth -- in' but hap -- pi -- ness.
	When we set -- tle down there'll __ be No More Blues. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startChords
	\startSong

	\myMark "A"
	\startPart
	d1:m7 | d2.:m7 d4:m7/c | b1:m7.5- | e:7.9- | \myEndLine
	e:m7.5- | a:7.9- | d:m | e2:m7.5- a:7.9- | \myEndLine
	d2:m d:m/c | b:m7.5- e:7 | a1*2:m | \myEndLine
	bes:maj7 | e1:m7.5- | a:7.9- | \myEndLine
	\endPart

	\myMark "A'"
	\startPart
	d1:m7 | d2.:m7 d4:m7/c | b1:m7.5- | e:7.9- | \myEndLine
	e:m7.5- | a:7.9- | d:m | d:7 | \myEndLine
	g2:m g:m/f | a:7/e a:7 | d1:m | d:m/c | \myEndLine
	b2:m7.5- e:7.9- | a1:7.9- | d:m | e2:m7 a:7.5+ | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	d1:maj7 | dis:dim7 | e1*2:m7 | \myEndLine
	a:7 | d1:dim7 | d:maj7 | \myEndLine
	fis:m7 | f:dim7 | e1*2:m7 | \myEndLine
	e:7 | e1:m7.5- | a:7.9- | \myEndLine
	\endPart

	\myMark "A''"
	\startPart
	d2:maj7 d:m7/cis | b1:m7 | e1*2:7 | \myEndLine
	fis1 | fis:7 | b2:m7 bes:m7 | a2:m7 d:7.9- | \myEndLine
	g1:maj7 | c:9 | fis:m7 | b2:7 b:7.5+ | \myEndLine
	e1:7 | e2..:m7/a a8:7/g | fis1:m7 | b:7.9- | \myEndLine
	e:7 | e2:m7/a e8:m7/a a4.:7 | d1*2 | \myEndLine
	\endPart

	\endSong
	\endChords
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Presto" 4 = 200
	\time 2/2
	\key f \major

	% part "A"
	f'2 a, | d2. f4 | e2 b! | d2. e4 |
	f2 bes, | cis f4 e~ | e8 d4 f8~ f e d4 | a1 |
	f'2 a, | b!2. d4 | c2 e~ | e4 e d c |
	c2 bes~ | bes4 f' e d | d cis e8 cis4 bes8~ | bes2. r4 |

	% part "A'"
	f'2 a, | d2. f4 | e2 b! | d2. e4 |
	f2 bes, | cis f4 e~ | e8 d4 cis8~ cis d ees4~ | ees d fis a |
	g2 bes | cis,~ cis8 a'4 g8~ | g f4 a8~ a g f4 | e4. d8 cis4 d |
	f8 d4 b!8~ b d4 f8~ | f cis4 bes8~ bes f'4 d8~ | d1 | r |

	\key d \major

	% part "B"
	fis2. a4 | g2. dis4 | fis e dis8 e4 b'8~ | b4 g e b |
	d4. cis8~ cis2~ | cis4 e cis8 a4 b8~ | b1 | a2. cis4 |
	e d cis8 d4 f8~ | f4 gis cis8 b4 a8~ | a g4 b,8~ b2~ | b4 b cis8 d4 fis8~ |
	fis4 e d8 b4 gis8~ | gis4 b cis8 e4 d8~ | d2~ d4. cis8~ | cis1 |

	% part "A''"
	fis2 a, | b2. fis'4 | e2 b | d2. e4 |
	fis2 ais, | cis2. fis4 | e8 d4 cis8~ cis d4 e8~ | e d4 fis8~ fis4 b |
	a8 fis4 d8~ d4. b8 | a' f!4 d8~ d4 bes | a'8 e4 cis8~ cis4 a | gis'4 b g! b |
	fis8 d4 b8 d4 fis~ | fis d b8 d4 fis8~ | fis2~ fis8 fis g a | b4 a g fis |
	d8 b4 d8 fis4 d~ | d b d8 fis4 d8~ | d1~ | d2. r4 |
}


}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1962 and 1967 Editora Musical Arapua, Sao Paulo, Brazil" }
	}
	\fill-line {
		\smaller \smaller { "TRO-Hollis Music, Inc., New York, controls all publication rights for the U.S.A. and Canada" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:15 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





